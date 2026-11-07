/**
 * Project naming for Discovery / creation.
 *
 * Kept separate from `ProjectRequirements` so technical matching never depends on names.
 * Today each supported Discovery branch produces one project; optional `workspaceName`
 * is reserved for a future Complete Product flow (possibly multi-component) without requiring it now.
 */
export type ProjectNaming = {
  /** Directory / package name for the generated project (npm naming rules). */
  projectName: string;
  /**
   * Optional workspace / monorepo label for future multi-project Discovery.
   * Unused by current single-project UI / Server / Worker flows.
   */
  workspaceName?: string;
};

/** Build naming for the current single-project Discovery paths. */
export function createProjectNaming(projectName: string): ProjectNaming {
  return { projectName };
}
