/**
 * UI libraries for client/hybrid templates (React, Vue, Svelte).
 * Not Nest/Hono/Gin/etc. — those belong in `BACKEND_FRAMEWORKS`.
 * Server / infrastructure templates omit `uiFramework`.
 */
export const UI_FRAMEWORKS = ["react", "vue", "svelte"] as const;

export type UiFramework = (typeof UI_FRAMEWORKS)[number];
