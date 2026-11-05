import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["apps/cli/src/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  clean: true,
  sourcemap: true,
  // Bundle private workspace packages into the published dist.
  noExternal: [/^@zealakit\//],
  banner: {
    js: "#!/usr/bin/env node",
  },
});
