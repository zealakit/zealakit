/**
 * HTTP / service stacks present in Go or Node server templates.
 * Express/Fastify are not scaffolded yet — omit until registered.
 */
export const BACKEND_FRAMEWORKS = ["hono", "nest", "gin", "stdlib"] as const;

export type BackendFramework = (typeof BACKEND_FRAMEWORKS)[number];
