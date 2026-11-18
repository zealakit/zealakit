import { defineConfig } from "tsup";

const shared = {
  format: ["esm"] as const,
  target: "node22",
  platform: "node" as const,
  sourcemap: true,
  // Bundle private workspace packages into the published dist.
  noExternal: [/^@zealakit\//],
};

export default defineConfig([
  {
    ...shared,
    format: [...shared.format],
    entry: { index: "apps/cli/src/index.ts" },
    clean: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    // `zealakit/api`: no shebang. Types come from `tsc -p apps/api/tsconfig.build.json`
    // (tsup's dts bundler needs the TypeScript 6 compiler API, which this repo does not use).
    ...shared,
    format: [...shared.format],
    entry: { api: "apps/api/src/index.ts" },
  },
]);
