import * as fseModule from "fs-extra";

/**
 * `@types/fs-extra` has no default export, while the runtime package is
 * CommonJS. Use the module object exposed by Node/esbuild interop instead of a
 * default import so the code works regardless of `allowSyntheticDefaultImports`.
 */
export const fse =
  (fseModule as typeof fseModule & { default?: typeof fseModule }).default ?? fseModule;
