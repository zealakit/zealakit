---
name: better-auth
description: Add and extend authentication with Better Auth. Use when wiring sign-in/sign-up, protecting routes, adding providers or plugins, or connecting a database.
---

# Better Auth

## What is wired

- A server `auth` instance (`src/lib/auth/auth.ts`, `server/utils/auth.ts` on Nuxt, `src/infrastructure/auth/auth.ts` on Hono) with email + password enabled.
- The HTTP handler under `/api/auth/*`.
- A client helper (`authClient`: `signIn`, `signUp`, `signOut`, `useSession`) on UI templates.

## Required environment

- `BETTER_AUTH_SECRET` — at least 32 random characters (`openssl rand -base64 32`).
- `BETTER_AUTH_URL` — the public base URL of this app.

## Conventions

- **No database is configured**, so users live in memory and are lost on restart. Before shipping, pass a `database` adapter to `betterAuth({ … })` (Drizzle, Prisma, Kysely, or a raw driver) and run the Better Auth CLI to generate the schema.
- Read the session on the server with `auth.api.getSession({ headers })`; never trust client-only checks.
- Add providers (`socialProviders`) and features (2FA, organizations) through Better Auth plugins; keep configuration in the single `auth` module.
- Keep the secret out of the repo and out of client bundles.
