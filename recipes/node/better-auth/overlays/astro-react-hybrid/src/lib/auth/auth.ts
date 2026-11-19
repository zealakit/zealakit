import { betterAuth } from "better-auth";

/**
 * Server-side Better Auth instance.
 *
 * No `database` is configured, so Better Auth keeps users in memory — fine for
 * local development, lost on restart. Add a database adapter (see the
 * better-auth skill) before shipping.
 */
export const auth = betterAuth({
  secret: import.meta.env.BETTER_AUTH_SECRET,
  baseURL: import.meta.env.BETTER_AUTH_URL ?? "http://localhost:4321",
  emailAndPassword: { enabled: true },
});
