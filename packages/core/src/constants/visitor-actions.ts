/** What visitors should be able to do on a UI (multi-select intent). */
export const VISITOR_ACTIONS = [
  "read-information",
  "browse-catalog",
  "submit-forms",
  "sign-in",
  "manage-information",
  "upload-files",
  "use-interactive-tools",
  "make-purchases",
  "call-existing-api",
] as const;

export type VisitorAction = (typeof VISITOR_ACTIONS)[number];
