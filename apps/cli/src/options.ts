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
  /** Package manager for install / next-step commands (default: detected). */
  pm?: string;
  /** `--install` / `--no-install`; undefined = ask when interactive, else no. */
  install?: boolean;
  /** `--git` / `--no-git`; undefined = ask when interactive, else no. */
  git?: boolean;
  /** `--no-manifest` sets this to false; default true. */
  manifest?: boolean;
  /** Apply a saved preset (flags override it). */
  preset?: string;
  /** Save the chosen template/recipes as a user preset after success. */
  savePreset?: string;
  /** Enter Project Discovery mode (interactive recommendations). */
  discover?: boolean;
};
