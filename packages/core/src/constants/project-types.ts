/**
 * High-level project kinds for Discovery matching.
 * Limited to shapes Zealakit templates can recommend today.
 */
export const PROJECT_TYPES = [
  "website",
  "web-app",
  "api",
  "fullstack",
  "worker",
  "unknown",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];
