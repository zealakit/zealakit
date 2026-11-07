# Discovery JSON API (stateless)

The Discovery engine is exposed as a versioned, stateless JSON contract for
external tools and UIs. It never prompts and never stores sessions; the caller
resubmits the accumulated answers with each request.

```bash
# Machine-readable create workflow (questions / recommendations / validate / scaffold)
echo '{"schemaVersion":1,"operation":"questions","answers":{}}' \
  | zealakit create --discover --json

# Same contract, but framed as the Discovery query command
zealakit discovery query < request.json
```

`zealakit create --discover --json` reads exactly one request from **stdin**
(no TTY, no prompts). `zealakit discovery query` reads stdin or `--input <file>`.
Both write one JSON response to stdout; diagnostics are never mixed into stdout.

| Exit | Meaning                                                                                    |
| ---- | ------------------------------------------------------------------------------------------ |
| 0    | Request processed (for `validate`, the selection is valid)                                 |
| 1    | Unexpected internal failure, or scaffold execution/commit failed (`SCAFFOLD_FAILED`)       |
| 2    | Malformed request, unsupported schema, unknown operation, confirmation/project invalid     |
| 3    | Invalid answers, invalid selection, `TARGET_EXISTS`, or `validate` returned `valid: false` |

## Envelope

```jsonc
{ "schemaVersion": 1, "ok": true, "operation": "questions", "data": {} }
{ "schemaVersion": 1, "ok": false, "operation": "recommendations", "error": { "code": "", "message": "", "details": [] } }
```

`schemaVersion` is `1` (`DISCOVERY_API_SCHEMA_VERSION`). Error codes are stable
(`DISCOVERY_API_ERROR_CODES`); do not parse `message`.

## Schema version policy

- Version `1` is additive: new optional request fields and new error codes may be
  added; existing required fields, operation names, and error codes stay stable.
- Removing/renaming a field or changing its meaning requires a new
  `schemaVersion`; unsupported versions return `UNSUPPORTED_SCHEMA_VERSION`.
- There is intentionally no multi-version framework yet.

## Request validation

Every request is validated before any operation runs: object shape,
`schemaVersion`, known operation, `answers`/`selection`/`project`/`confirmation`
types, enum values, and unknown answer keys. Errors include a stable `code` and
field-oriented `details`; nothing is coerced silently.

## Error codes

`INVALID_REQUEST`, `UNSUPPORTED_SCHEMA_VERSION`, `UNKNOWN_OPERATION`,
`INVALID_ANSWERS`, `UNSUPPORTED_PROJECT_TYPE`, `INVALID_SELECTION`,
`UNKNOWN_TEMPLATE`, `UNKNOWN_RECIPE`, `INCOMPATIBLE_TEMPLATE`,
`INCOMPATIBLE_RECIPE`, `RECIPE_CONFLICT`, `MISSING_DEPENDENCY`,
`DEPENDENCY_CYCLE`, `CONFIRMATION_REQUIRED`, `INVALID_PROJECT`,
`PROJECT_NAME_INVALID`, `INVALID_PROJECT_DIRECTORY`, `TARGET_EXISTS`,
`SELECTION_INVALID`, `SCAFFOLD_VALIDATION_FAILED`, `SCAFFOLD_FAILED`,
`INTERNAL`.

## Operations

### `questions`

```jsonc
{ "schemaVersion": 1, "operation": "questions", "answers": {} }
```

`data`: `{ question, complete, answered, progress: { answered, total } }`.
`question` is the next applicable unanswered question (or `null` when the branch
is complete). Option values are reused from the questionnaire; clients append a
"no preference" choice themselves using `allowNoPreference` / `noPreferenceLabel`.
Partial answers are validated for type/enum/unknown keys but required questions
may still be unanswered.

### `recommendations`

```jsonc
{ "schemaVersion": 1, "operation": "recommendations", "answers": { "projectType": "server-api" } }
```

Requires a complete, valid answer set. `data` contains `requirements`,
`recommendedTemplateId`, `recommendedRecipeIds`, and ranked `templates` /
`recipes` with `score`, `compatible`, `reasons` and `warnings`. Ordering and
scores come from the existing Discovery engine — nothing is recomputed here.

### `validate`

```jsonc
{
  "schemaVersion": 1,
  "operation": "validate",
  "answers": {},
  "selection": { "templateId": "nest", "recipeIds": ["biome"] }
}
```

Reuses scaffold/Discovery compatibility rules: unknown ids (top-level error),
recipe dependency resolution, exclusive-category conflicts, template/recipe
compatibility, and — when `answers` are supplied — Discovery template/recipe
compatibility. `data`: `{ valid, errors, warnings, templateId, resolvedRecipeIds }`.
`resolvedRecipeIds` includes default recipes and `dependsOn` expansion. No files
are written.

### `scaffold`

```jsonc
{
  "schemaVersion": 1,
  "operation": "scaffold",
  "answers": { "projectType": "ui", "uiTechPreference": "react" },
  "selection": { "templateId": "vite-react", "recipeIds": [] },
  "project": { "name": "my-app", "directory": "./my-app" },
  "confirmation": { "confirmed": true }
}
```

- Requires `confirmation.confirmed === true`; missing/false never scaffolds.
- Re-runs selection validation (never trusts an earlier `validate` response),
  validates the project name, refuses a non-empty target directory, then runs
  the existing `scaffoldProject` pipeline (staging, validation, atomic commit).
- `project.directory` is optional; when provided, its basename must equal
  `project.name` (defaults to `./<name>` under the process cwd). The target may
  not be the working directory or one of its parents, and an existing non-empty
  target is refused (`TARGET_EXISTS`) — existing projects are never overwritten.
- `data`: `{ projectName, templateId, recipeIds, outputDirectory }` where
  `recipeIds` includes default recipes and `dependsOn` expansion.
- Errors: `CONFIRMATION_REQUIRED`, `INVALID_PROJECT`, `PROJECT_NAME_INVALID`,
  `INVALID_PROJECT_DIRECTORY`, `TARGET_EXISTS`, `SELECTION_INVALID`,
  `SCAFFOLD_VALIDATION_FAILED`, `SCAFFOLD_FAILED`.

## Guarantees

- Stateless: no session store, feedback file, or hidden state is read.
- Deterministic: registry order / engine ranking / stable key order; repeated
  identical requests return equivalent responses (no timestamps/random ids).
- Public error messages redact absolute staging/backup paths.
- Serializable: no functions or mutable registry references; optional Discovery
  profile fields may be omitted by JSON.
- No terminal dependencies in `packages/core/src/discovery`, `profiles`, `info`.
- Interactive `zealakit create --discover` keeps using the same questionnaire,
  validation, scoring and ranking logic.
