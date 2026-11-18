import { betterAuth } from "better-auth";

/**
 * Server-side Better Auth instance.
 *
 * No `database` is configured, so Better Auth keeps users in memory — fine for
 * local development, lost on restart. Add a database adapter (see the
 * better-auth skill) before shipping.
 */
export const auth = betterAuth({
  // `next build` imports this module without runtime env; a placeholder keeps the build
  // working while a real server (NEXT_PHASE differs) still requires BETTER_AUTH_SECRET.
  secret:
    process.env.BETTER_AUTH_SECRET ??
    (process.env.NEXT_PHASE === "phase-production-build"
      ? "build-time-placeholder-secret-not-used-at-runtime"
      : undefined),
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true },
});
