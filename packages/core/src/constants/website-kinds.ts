/** User-facing website / UI product kinds (Discovery intent). */
export const WEBSITE_KINDS = [
  "business-marketing",
  "landing-page",
  "blog-content",
  "portfolio",
  "management-dashboard",
  "online-store",
  "interactive-tool",
  "other",
] as const;

export type WebsiteKind = (typeof WEBSITE_KINDS)[number];
