/**
 * UI libraries for client/hybrid templates (React, Vue, Svelte).
 * Not Nest/Hono/Gin/etc. — those belong in `BACKEND_FRAMEWORKS`.
 * Server / infrastructure templates omit `uiFramework`.
 */
export const UI_FRAMEWORKS = ["react", "vue", "svelte"] as const;

export type UiFramework = (typeof UI_FRAMEWORKS)[number];

/**
 * Soft default ecosystem preference when Discovery has no explicit UI framework choice.
 * Ranking only — never a hard eligibility filter. Skip frameworks with no registered template.
 */
export const DEFAULT_UI_FRAMEWORK_PREFERENCE = ["react", "vue", "svelte"] as const;

export type DefaultUiFrameworkPreference = (typeof DEFAULT_UI_FRAMEWORK_PREFERENCE)[number];
