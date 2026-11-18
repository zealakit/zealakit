/** Raw options for `zealakit create` / the root scaffold command. */
export type CliOptions = {
  projectName?: string;
  template?: string;
  with?: string;
  /** Non-interactive: never prompts; a non-empty target is refused unless `--force`. */
  yes?: boolean;
  /** Overwrite a non-empty target without asking. */
  force?: boolean;
  dryRun?: boolean;
  info?: boolean;
  json?: boolean;
  /** Enter Project Discovery mode (interactive recommendations). */
  discover?: boolean;
};
