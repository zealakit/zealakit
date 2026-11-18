import { betterAuth } from "better-auth";

/**
 * Server-side Better Auth instance.
 *
 * No `database` is configured, so Better Auth keeps users in memory — fine for
 * local development, lost on restart. Add a database adapter (see the
 * better-auth skill) before shipping.
 */
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  emailAndPassword: { enabled: true },
});
