import fs from "node:fs";
import path from "node:path";
import { ExitCode } from "@zealakit/core/internal";
import type { Command } from "commander";
import { serveMcp } from "../../mcp/src/server.js";
import { readKitManifest } from "./manifest.js";
import { failDiagnostic } from "./output.js";

/** `zealakit mcp --root <dir>` — an MCP (stdio) server for coding agents. */
export function registerMcpCommand(program: Command): void {
  program
    .command("mcp")
    .description("Run an MCP server on stdio so AI agents can plan, create, add and check projects")
    .option("--root <dir>", "Directory the agent may read and write (default: current directory)")
    .action(async (options: { root?: string }) => {
      const root = path.resolve(options.root ?? process.cwd());
      if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
        failDiagnostic(
          {
            title: "Invalid usage",
            reason: `--root '${root}' is not a directory.`,
            resolution: "Run: zealakit mcp --root <existing directory>",
          },
          ExitCode.USAGE,
        );
      }
      // stdout carries only protocol messages; anything human goes to stderr.
      process.stderr.write(`zealakit MCP server ready (root: ${root})\n`);
      await serveMcp({
        root,
        version: readKitManifest().version,
        input: process.stdin,
        output: process.stdout,
      });
    });
}
