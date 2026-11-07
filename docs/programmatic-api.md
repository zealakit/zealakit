# Programmatic API

Zealakit can be used from TypeScript without invoking the CLI. The API is a thin
façade over the same registry, metadata query layer, Discovery engine, and
scaffold pipeline used by `zealakit create`.

**Distribution:** the published npm package (`zealakit`) currently ships the CLI
(`dist/index.js`) plus templates/recipes. The programmatic API is consumed from
the workspace packages `@zealakit/core` and `@zealakit/ecosystem-node` /
`@zealakit/ecosystem-go` (source exports with full types). A published `/api`
subpath is not part of this release.

## Requirements

- Node.js 22.12+
- Import from the workspace/source TypeScript packages; no terminal, TTY, or
  `@clack/prompts` is involved.

## Register ecosystems

Registration is explicit and process-global; `createZealakit` never imports
ecosystem packages. Use only the ecosystems you need.

```ts
import { createZealakit } from "@zealakit/core";
import { nodeEcosystem } from "@zealakit/ecosystem-node";

const zealakit = createZealakit({ ecosystems: [nodeEcosystem] });
```

Both ecosystems:

```ts
import { goEcosystem } from "@zealakit/ecosystem-go";

const zealakit = createZealakit({
  ecosystems: [nodeEcosystem, goEcosystem],
});
```

- Duplicate or unknown ecosystem ids throw before any registration side effect.
- Official `register*` functions are idempotent; creating multiple instances
  does not duplicate registry entries. The registry itself is the existing
  process-global catalog (there is no hidden per-instance registry).

## Metadata

All results are detached snapshots with deterministic ordering.

```ts
const templates = zealakit.metadata.getTemplates({ ecosystem: "node", scope: "server" });
const recipes = zealakit.metadata.getRecipes({ templateId: "nest" });
const ecosystems = zealakit.metadata.getEcosystems();
const withDiscovery = zealakit.metadata.getTemplates({ discovery: true });
```

## Discovery

Same operations/results as the JSON contract and interactive CLI.

```ts
const questions = await zealakit.discovery.getQuestions({ answers: {} });
const recommendations = await zealakit.discovery.getRecommendations({
  answers: { projectType: "server-api", backendRuntime: "node", apiStorageNeed: "none" },
});
const validation = await zealakit.discovery.validateSelection({
  answers: { projectType: "server-api", backendRuntime: "node", apiStorageNeed: "none" },
  selection: { templateId: "nest", recipeIds: ["biome"] },
});
```

- `getQuestions` returns the next applicable question; partial answers are
  allowed.
- Invalid requests throw `ZealakitApiError` with stable `code` and `details`.
- `validateSelection` returns `{ valid, errors, warnings, resolvedRecipeIds, … }`;
  an invalid selection is data (`valid: false`), not an exception.

## Scaffold plan (read-only)

```ts
const plan = zealakit.scaffold.plan(
  { projectName: "my-api", templateId: "nest", recipeIds: ["biome"] },
  { cwd: "/tmp/work" },
);

if (plan.blockers.length > 0) {
  // report plan.blockers / plan.checks / plan.packages
}
```

Planning never writes files or creates directories.

## Scaffold execution (explicit)

```ts
const result = await zealakit.scaffold.create(
  { projectName: "my-api", templateId: "nest", recipeIds: ["biome"] },
  { cwd: "/tmp/work" },
);

console.log(result.outputDirectory); // absolute target directory
```

- Runs the same staging → validate → atomic commit pipeline as the CLI, including
  manifest merging, `.cursor → .agents`, and generated-output validation.
- Refuses invalid configs and non-empty destination directories
  (non-interactive `yes` semantics) before writing.
- No artificial `confirmation` flag: calling `create` is itself the explicit
  execution step for programmatic consumers. The CLI/JSON adapters own user
  confirmation.
- `recipeIds` in the result are the requested ids; the engine also applies
  default recipes and `dependsOn` internally.

## Errors

| Error                                                  | Raised by                                                |
| ------------------------------------------------------ | -------------------------------------------------------- |
| `ZealakitApiError` (`code`, `details`)                 | Discovery request/answer/selection validation            |
| `ScaffoldValidationError` (`errors[]`)                 | invalid config, non-empty target, plan/output validation |
| `ScaffoldCommitError` (backup/temp paths on the error) | filesystem/commit failures                               |

No exit codes are used by the programmatic API.
