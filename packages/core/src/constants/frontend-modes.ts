/** Rendering / delivery modes covered by current client & hybrid templates. */
export const FRONTEND_MODES = ["spa", "ssg", "ssr", "islands", "static"] as const;

export type FrontendMode = (typeof FRONTEND_MODES)[number];
