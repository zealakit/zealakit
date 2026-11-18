# Discovery review (beta)

Plan 05 §F asked for a keep-or-simplify decision. This records it.

## Evidence

- **Size:** `packages/core/src/discovery` is ~5.3k lines (questionnaire, requirement resolver, scoring, ranking, local feedback) to choose among 12 templates.
- **Local feedback** (`zealakit discovery stats`, opt-in and offline) on the maintainer's machine shows 31 sessions: 1 completed, 29 cancelled, 1 "no compatible match". Those are almost entirely test and manual runs, so they say nothing about real usage. There is no remote telemetry by design, so beta users' data is not available to us.

## Decision: **keep**, and freeze the JSON API

- The Discovery JSON API (`create --discover --json`, `discovery query`) is the backend other tools and agents drive; its envelope is now pinned by `schema/discovery-response.schema.json` and `tests/unit/contract-schemas.test.ts` (see `docs/stability.md`).
- Simplifying now would break that contract for no measured gain. Revisit once there is real usage data: ask beta users to run `zealakit discovery stats` and share the numbers, then decide whether a 3-question flow is warranted.
- Keep local feedback opt-in and local. No remote telemetry.

## Consequences already applied

- Template and recipe Discovery profiles live on the template/recipe definitions in each ecosystem package (`discovery` field), so new recipes (`vitest`, `better-auth`, `goose`, …) never touch core.
- Every registered template needs a profile (the startup check enforces it), and Discovery's tests pin the exact ranking of the four Backend/API templates. A fifth Go API template therefore needs a deliberate ranking review. For that reason `chi-api` (plan 05 §E) was **not** added in this beta; the Go recipes (`goose`, `sqlc`, `redis`) were.
- The `auth` capability exists and `better-auth` / `nest-auth` declare it, but the questionnaire has no "users sign in" question yet. Adding one is a Discovery change and goes through this review.
