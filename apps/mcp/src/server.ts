import fs from "node:fs";
import path from "node:path";
import {
  createZealakit,
  goEcosystem,
  nodeEcosystem,
  pythonEcosystem,
  type ScaffoldConfig,
  type Zealakit,
  ZealakitApiError,
} from "../../api/src/index.js";

/**
 * Minimal Model Context Protocol server (JSON-RPC 2.0 over newline-delimited
 * stdio) that exposes zealakit to coding agents.
 *
 * It only calls the published `zealakit/api` surface and never touches paths
 * outside `root`. Writing tools are explicit: `create` needs `confirm: true`,
 * `add` is a dry run unless `dryRun: false`.
 */

export const MCP_PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED_PROTOCOLS = new Set(["2024-11-05", "2025-03-26", "2025-06-18"]);

type Json = Record<string, unknown>;

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: Json;
  /** Whether the tool can write files (annotation only; the handler enforces it). */
  writes: boolean;
  handler: (args: Json) => unknown | Promise<unknown>;
};

const str = { type: "string" };
const strList = { type: "array", items: { type: "string" } };

export type McpServerOptions = {
  /** Directory every path is resolved against; nothing outside it is touched. */
  root: string;
  version: string;
  zealakit?: Zealakit;
};

class ToolError extends Error {}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "")
    throw new ToolError(`'${label}' must be a non-empty string.`);
  return value;
}

function asStringList(value: unknown, label: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ToolError(`'${label}' must be an array of strings.`);
  }
  return value as string[];
}

/** Resolve `relative` inside `root`; reject anything that escapes (including via symlinks). */
export function resolveInsideRoot(root: string, relative: string): string {
  if (path.isAbsolute(relative)) throw new ToolError("Paths must be relative to the MCP root.");
  const resolved = path.resolve(root, relative);
  const rel = path.relative(root, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new ToolError(`'${relative}' is outside the allowed root.`);
  }
  // Follow symlinks for the deepest existing ancestor.
  let probe = resolved;
  while (!fs.existsSync(probe) && probe !== root) probe = path.dirname(probe);
  const realProbe = fs.realpathSync(probe);
  const realRoot = fs.realpathSync(root);
  const realRel = path.relative(realRoot, realProbe);
  if (realRel.startsWith("..") || path.isAbsolute(realRel)) {
    throw new ToolError(`'${relative}' resolves outside the allowed root.`);
  }
  return resolved;
}

export function createMcpServer(options: McpServerOptions) {
  const root = path.resolve(options.root);
  const zealakit =
    options.zealakit ??
    createZealakit({ ecosystems: [nodeEcosystem, goEcosystem, pythonEcosystem] });

  const configFrom = (args: Json): ScaffoldConfig => ({
    projectName: asString(args.projectName, "projectName"),
    templateId: asString(args.templateId, "templateId"),
    recipeIds: asStringList(args.recipeIds, "recipeIds"),
  });

  const tools: ToolDefinition[] = [
    {
      name: "list_templates",
      description:
        "List project templates (id, scope, ecosystem, UI framework, compatible recipes).",
      inputSchema: {
        type: "object",
        properties: {
          ecosystem: { enum: ["node", "go", "python"] },
          scope: str,
          discovery: { type: "boolean" },
        },
      },
      writes: false,
      handler: (args) => zealakit.metadata.getTemplates(args as never),
    },
    {
      name: "list_recipes",
      description:
        "List recipes, optionally only those compatible with a template or in a category.",
      inputSchema: {
        type: "object",
        properties: {
          templateId: str,
          ecosystem: { enum: ["node", "go", "python"] },
          category: str,
        },
      },
      writes: false,
      handler: (args) => zealakit.metadata.getRecipes(args as never),
    },
    {
      name: "recommend",
      description:
        "Discovery: recommend a template and recipes from questionnaire answers (use the `questions` operation in the CLI JSON API to learn the answer keys).",
      inputSchema: {
        type: "object",
        required: ["answers"],
        properties: { answers: { type: "object" } },
      },
      writes: false,
      handler: async (args) =>
        zealakit.discovery.getRecommendations({ answers: (args.answers ?? {}) as never }),
    },
    {
      name: "plan",
      description:
        "Dry-run a new project: returns files, packages, checks, blockers and warnings. Writes nothing.",
      inputSchema: {
        type: "object",
        required: ["projectName", "templateId"],
        properties: { projectName: str, templateId: str, recipeIds: strList },
      },
      writes: false,
      handler: (args) => zealakit.scaffold.plan(configFrom(args), { cwd: root }),
    },
    {
      name: "create",
      description:
        "Create a project under the MCP root. Requires confirm: true and refuses a non-empty target.",
      inputSchema: {
        type: "object",
        required: ["projectName", "templateId", "confirm"],
        properties: {
          projectName: str,
          templateId: str,
          recipeIds: strList,
          confirm: { type: "boolean", description: "Must be true to write files." },
        },
      },
      writes: true,
      handler: async (args) => {
        if (args.confirm !== true) {
          throw new ToolError(
            "Refusing to write files: pass confirm: true after reviewing the plan.",
          );
        }
        const config = configFrom(args);
        resolveInsideRoot(root, config.projectName);
        const result = await zealakit.scaffold.create(config, { cwd: root });
        return { ...result, outputDirectory: path.relative(root, result.outputDirectory) || "." };
      },
    },
    {
      name: "add",
      description:
        "Add recipes to an existing zealakit project. Defaults to a dry run (dryRun: true); set dryRun: false to apply. Files you edited are reported as conflicts and kept.",
      inputSchema: {
        type: "object",
        required: ["recipeIds"],
        properties: {
          projectDir: { type: "string", description: "Relative to the MCP root (default '.')." },
          recipeIds: strList,
          dryRun: { type: "boolean", description: "Default true." },
          overwriteFiles: { type: "boolean" },
        },
      },
      writes: true,
      handler: (args) => {
        const dir = resolveInsideRoot(
          root,
          typeof args.projectDir === "string" ? args.projectDir : ".",
        );
        const plan = zealakit.project.planAdd(dir, asStringList(args.recipeIds, "recipeIds"));
        const summary = {
          added: plan.added,
          autoInjected: plan.autoInjected,
          alreadyApplied: plan.alreadyApplied,
          blockers: plan.blockers,
          warnings: plan.warnings,
          packageChanges: plan.packageChanges,
          changes: plan.changes.map(({ path: file, kind, diff, note }) => ({
            path: file,
            kind,
            diff,
            note,
          })),
        };
        if (args.dryRun !== false || plan.blockers.length > 0 || plan.added.length === 0) {
          return { applied: false, ...summary };
        }
        const result = zealakit.project.applyAdd(plan, {
          overwriteFiles: args.overwriteFiles === true,
        });
        return { applied: true, ...summary, result };
      },
    },
    {
      name: "doctor",
      description:
        "Health-check a generated project (manifest, agent docs, recipe files, env, dependencies).",
      inputSchema: { type: "object", properties: { projectDir: str } },
      writes: false,
      handler: (args) =>
        zealakit.project.check(
          resolveInsideRoot(root, typeof args.projectDir === "string" ? args.projectDir : "."),
        ),
    },
    {
      name: "outdated",
      description: "Compare a project's template/recipe dependency ranges with the installed kit.",
      inputSchema: { type: "object", properties: { projectDir: str } },
      writes: false,
      handler: (args) =>
        zealakit.project.outdated(
          resolveInsideRoot(root, typeof args.projectDir === "string" ? args.projectDir : "."),
        ),
    },
  ];

  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  async function callTool(name: unknown, args: unknown): Promise<Json> {
    const tool = typeof name === "string" ? byName.get(name) : undefined;
    if (!tool)
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool '${String(name)}'.` }],
      };
    try {
      const result = await tool.handler(
        (typeof args === "object" && args !== null ? args : {}) as Json,
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      const message =
        error instanceof ZealakitApiError
          ? `${error.code}: ${error.message}\n${error.details.join("\n")}`
          : error instanceof Error
            ? error.message
            : String(error);
      return { isError: true, content: [{ type: "text", text: message }] };
    }
  }

  /** Handle one JSON-RPC message; returns the response, or `undefined` for notifications. */
  async function handle(message: unknown): Promise<Json | undefined> {
    if (typeof message !== "object" || message === null || Array.isArray(message)) {
      return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } };
    }
    const request = message as { id?: unknown; method?: unknown; params?: Json };
    const hasId = request.id !== undefined && request.id !== null;
    const reply = (result: unknown): Json | undefined =>
      hasId ? { jsonrpc: "2.0", id: request.id, result } : undefined;
    const fail = (code: number, text: string): Json | undefined =>
      hasId ? { jsonrpc: "2.0", id: request.id, error: { code, message: text } } : undefined;

    switch (request.method) {
      case "initialize": {
        const requested = request.params?.protocolVersion;
        return reply({
          protocolVersion:
            typeof requested === "string" && SUPPORTED_PROTOCOLS.has(requested)
              ? requested
              : MCP_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "zealakit", version: options.version },
          instructions: `Scaffold projects with zealakit. All paths are relative to ${root}. Use plan before create; add is a dry run by default.`,
        });
      }
      case "ping":
        return reply({});
      case "tools/list":
        return reply({
          tools: tools.map(({ name, description, inputSchema, writes }) => ({
            name,
            description,
            inputSchema,
            annotations: { readOnlyHint: !writes },
          })),
        });
      case "tools/call":
        return reply(await callTool(request.params?.name, request.params?.arguments));
      default:
        if (typeof request.method === "string" && request.method.startsWith("notifications/"))
          return undefined;
        return fail(-32601, `Method not found: ${String(request.method)}`);
    }
  }

  return { handle, root, toolNames: tools.map((tool) => tool.name) };
}

/** Run the server on newline-delimited JSON streams until `input` ends. */
export async function serveMcp(
  options: McpServerOptions & { input: NodeJS.ReadableStream; output: NodeJS.WritableStream },
): Promise<void> {
  const server = createMcpServer(options);
  let buffer = "";
  const pending = new Set<Promise<void>>();

  const process = async (line: string): Promise<void> => {
    if (line.trim() === "") return;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      options.output.write(
        `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`,
      );
      return;
    }
    const response = await server.handle(message);
    if (response) options.output.write(`${JSON.stringify(response)}\n`);
  };

  await new Promise<void>((resolve) => {
    options.input.on("data", (chunk) => {
      buffer += String(chunk);
      let index = buffer.indexOf("\n");
      while (index !== -1) {
        const task = process(buffer.slice(0, index));
        pending.add(task);
        task.finally(() => pending.delete(task));
        buffer = buffer.slice(index + 1);
        index = buffer.indexOf("\n");
      }
    });
    options.input.on("end", resolve);
  });
  await Promise.all(pending);
}
