import assert from "node:assert/strict";
import { templateSuite } from "../helpers/cases.js";

type BiomeConfig = {
  root?: boolean;
  javascript?: { parser?: { unsafeParameterDecoratorsEnabled?: boolean } };
  linter?: { domains?: Record<string, string> };
};

templateSuite("hono", {
  pass: [
    {
      name: "biome",
      recipes: ["biome"],
      exists: [
        "biome.json",
        "src/bootstrap/main.ts",
        "src/bootstrap/create-app.ts",
        ".agents/skills/structure-ddd/SKILL.md",
        ".agents/skills/hono/SKILL.md",
        "AGENTS.md",
      ],
      absent: ["src/lib/apis/example.ts"],
      deps: ["hono", "@hono/node-server"],
      noDeps: ["@nestjs/common"],
      scripts: { dev: "tsx watch src/bootstrap/main.ts" },
      contains: { "AGENTS.md": [".agents/skills/hono/SKILL.md"] },
      check: (app) => {
        const biome = app.json<BiomeConfig>("biome.json");
        assert.equal(biome.root, undefined);
        assert.equal(biome.javascript?.parser?.unsafeParameterDecoratorsEnabled, undefined);
        assert.equal(biome.linter?.domains?.next, undefined);
      },
    },
    {
      name: "eslint",
      recipes: ["eslint"],
      exists: ["eslint.config.js"],
      absent: ["biome.json"],
      noDevDeps: ["eslint-plugin-react-hooks"],
      contains: { "eslint.config.js": ["globals.node"] },
      excludes: { "eslint.config.js": ["react-hooks"] },
    },
    {
      name: "drizzle-orm + biome",
      recipes: ["drizzle-orm", "biome"],
      exists: [
        "src/infrastructure/persistence/drizzle/drizzle.bootstrap.ts",
        "src/infrastructure/persistence/drizzle/drizzle.client.ts",
        "drizzle.config.ts",
      ],
      absent: ["src/infrastructure/persistence/drizzle/drizzle.module.ts"],
      deps: ["hono"],
      noDeps: ["better-sqlite3", "@nestjs/typeorm"],
      contains: { "src/bootstrap/container.ts": ["// import { createDrizzleClient }"] },
    },
    {
      name: "type-orm enables decorators",
      recipes: ["type-orm"],
      contains: {
        "tsconfig.json": ['"experimentalDecorators": true'],
        "src/bootstrap/container.ts": ["// import { createTypeOrmDataSource }"],
      },
    },
  ],
  reject: [{ name: "kyjs (client)", recipes: ["kyjs"] }],
});
