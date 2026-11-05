/** Template delivery shape (what kind of app is scaffolded). */
export const SCOPES = ["client", "server", "hybrid", "infrastructure"] as const;

export type Scope = (typeof SCOPES)[number];
