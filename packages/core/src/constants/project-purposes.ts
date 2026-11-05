/** Intent / domain context for Discovery (orthogonal to project type). */
export const PROJECT_PURPOSES = [
  "saas",
  "business",
  "internal-tool",
  "developer-tool",
  "api-service",
  "ecommerce",
  "content-platform",
  "prototype",
  "learning",
  "other",
] as const;

export type ProjectPurpose = (typeof PROJECT_PURPOSES)[number];
