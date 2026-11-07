/** Environment for CLI subprocesses whose stderr must stay empty. */
export function noColorEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const { FORCE_COLOR: _forceColor, NO_COLOR: _noColor, ...env } = process.env;
  return { ...env, ...overrides, NO_COLOR: "1" };
}

/** Environment that forces ANSI output without the NO_COLOR/FORCE_COLOR conflict. */
export function forceColorEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const { FORCE_COLOR: _forceColor, NO_COLOR: _noColor, ...env } = process.env;
  return { ...env, ...overrides, FORCE_COLOR: "1" };
}
