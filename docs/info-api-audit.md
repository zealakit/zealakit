# Info JSON API audit

Audit of the existing `zealakit info` machine-readable surface against the needs
of external tools, CI, and AI agents. This document records what exists, what
was missing, and the minimal changes made.

## 1. Current capabilities

The existing Info layer is not a stub. It already provides:

- A versioned envelope: `{ schemaVersion: 4, command: "info", filters, data }`.
- CLI metadata from the host `package.json`: name, bin, version, description,
  homepage, engines, and usage strings.
- Full template metadata: id, name, label, description, scope, UI framework,
  ecosystem, path, overlay, source directory, dev command, default flag,
  default recipes, compatible recipes, and prompt steps.
- Full recipe metadata: id, name, hint, ecosystem, categories, exclusivity,
  default flag, `dependsOn`, supported scopes, UI frameworks, compatible
  templates, incompatible templates with code + message, conflicts, package
  maps (including overlays), scripts, transformed files, and agent-entry flag.
- Vocabulary and membership metadata for ecosystems, scopes, project types, UI
  frameworks, recipe categories, and compatibility rules.
- Optional resolved Discovery profiles (`--discover`) without running the
  questionnaire or recommendation engine.
- Filters for ecosystem, scope, project type, UI framework, template id, recipe
  id, category, and Discovery-profile availability.
- AND filter semantics, rejection of unknown filter values, deterministic
  ordering, and snapshot cloning (no mutable registry references).
- A separate, stateless Discovery JSON API with schema version 1.

## 2. Gaps

### P0 — integration blockers

None found. Existing consumers can enumerate templates/recipes, inspect
compatibility, filter by the documented vocabulary, read versions, and parse a
stable envelope.

### P1 — important metadata/query gaps

#### P1-1: Capability vocabulary and membership were not exposed

- **Current behavior:** Discovery profiles contain `capabilities`, but the
  authoritative `CAPABILITIES` list is not in `info`, and there is no
  capability → template/recipe mapping.
- **Missing capability:** Consumers cannot enumerate valid capability values,
  validate profile data, or ask which entities provide a capability without
  importing internal source.
- **Why needed:** Capabilities are the main machine-readable description of what
  a template or recipe adds (`web-ui`, `http-api`, `database`, …). External
  recommendation UIs and CI policy checks need to validate them.
- **Could existing functionality provide it?** Only by reading embedded
  `--discover` profiles and hardcoding the enum. That is not reliable.
- **Minimal change:** Add `data.capabilities` (id + visible templates + visible
  recipes), mirroring existing `scopes` / `uiFrameworks` sections.
- **Compatibility:** Additive field in schema v4; no existing field changes.

#### P1-2: No capability filter

- **Current behavior:** Filtering by capability requires `--discover` and
  client-side scanning of every profile.
- **Missing capability:** `zealakit info --json --capability <id>`.
- **Why needed:** Common integration query: “which templates/recipes provide
  `database` or `web-ui`?” Must compose with existing AND filters.
- **Could existing functionality provide it?** Not as a filter; only via
  post-processing the full snapshot.
- **Minimal change:** Add optional `capability` to `InfoFilter` /
  `InfoFilterInput`, validate it against `CAPABILITIES`, apply it to template
  and recipe profile capabilities, and add the CLI flag.
- **Compatibility:** Optional filter; echoed only when used. Invalid values are
  rejected like every other filter.

### P2 — convenience, intentionally unchanged

#### P2-1: Pair-specific incompatibility reason

- **Current behavior:** An unfiltered `--recipe <id>` response includes
  `incompatibleTemplates` with `code` and `message`. A query combining
  `--template` and `--recipe` returns empty sections when the pair is
  incompatible.
- **Why not changed:** The reason is already available from the recipe-centric
  query; changing pair semantics would break the documented AND filter contract.
  Consumers should query `--recipe <id>` and inspect `incompatibleTemplates`.
- **Compatibility:** None.

#### P2-2: Separate profile listing

- **Current behavior:** `--discover` embeds resolved profiles on templates and
  recipes.
- **Why not changed:** Profile ids are entity ids, and a separate profiles array
  would duplicate metadata and add a second representation to keep in sync.
- **Compatibility:** None.

#### P2-3: Language filter

- **Current behavior:** No `language` field; `ecosystem` (`node` / `go`) is the
  ownership boundary.
- **Why not changed:** There is no independent language metadata source. Adding
  one would invent a second source of truth.
- **Compatibility:** None.

#### P2-4: Discovery schema version inside Info

- **Current behavior:** Info exposes its own `schemaVersion`; the Discovery JSON
  API exposes `schemaVersion: 1` separately.
- **Why not changed:** Info should not depend on Discovery transport constants.
  Consumers pin both contracts from their respective docs/responses.
- **Compatibility:** None.

## 3. Implemented changes

1. `data.capabilities`: capability vocabulary plus visible template/recipe
   membership.
2. `capability` filter, CLI `--capability`, validation, deterministic ordering,
   and invalid-value rejection.
3. `getCapabilityMetadata(filter?)` helper exported from `@zealakit/core`.
4. Tests for vocabulary, filtering, AND composition, JSON shape, invalid values,
   and schema-version stability.

## 4. Schema impact

- `INFO_SCHEMA_VERSION` remains **4**.
- `data.capabilities` is a new additive field.
- `filters.capability` appears only when the filter is used.
- No fields were renamed or removed; no enum values were added.
- Existing consumers that ignore unknown keys are unaffected.
