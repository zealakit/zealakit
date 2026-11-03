import assert from "node:assert/strict";
import { templateSuite } from "../helpers/cases.js";

type BiomeConfig = {
  root?: boolean;
  javascript?: { parser?: { unsafeParameterDecoratorsEnabled?: boolean } };
  linter?: { domains?: Record<string, string> };
};

templateSuite("nest", {
  pass: [
    {
      name: "biome",
      recipes: ["biome"],
      exists: [
        "biome.json",
        "src/bootstrap/main.ts",
        ".agents/skills/structure-ddd/SKILL.md",
        ".agents/skills/nestjs/SKILL.md",
        "AGENTS.md",
      ],
      absent: ["src/lib/apis/example.ts"],
      deps: ["@nestjs/common"],
      noDevDeps: ["eslint-plugin-react-hooks"],
      contains: { "AGENTS.md": [".agents/skills/structure-ddd/SKILL.md"] },
      check: (app) => {
        const biome = app.json<BiomeConfig>("biome.json");
        assert.equal(biome.root, undefined);
        assert.equal(biome.javascript?.parser?.unsafeParameterDecoratorsEnabled, true);
        assert.equal(biome.linter?.domains?.next, undefined);
      },
    },
    {
      name: "eslint",
      recipes: ["eslint"],
      exists: ["eslint.config.js"],
      absent: ["biome.json"],
      noDevDeps: ["eslint-plugin-react-hooks", "eslint-plugin-react-refresh"],
      contains: { "eslint.config.js": ["globals.node"] },
      excludes: { "eslint.config.js": ["eslint-plugin-react-hooks"] },
    },
    {
      name: "type-orm + biome",
      recipes: ["type-orm", "biome"],
      exists: [
        "src/infrastructure/persistence/typeorm/typeorm.module.ts",
        ".agents/skills/type-orm/SKILL.md",
      ],
      noDeps: ["better-sqlite3"],
      contains: {
        "src/bootstrap/app.module.ts": ["// import { TypeormPersistenceModule }"],
        "AGENTS.md": [".agents/skills/type-orm/SKILL.md"],
      },
      check: (app) => {
        const active = app.read("src/bootstrap/app.module.ts").replace(/\/\/[^\n]*/g, "");
        assert.doesNotMatch(active, /imports:\s*\[[^\]]*TypeormPersistenceModule/);
      },
    },
    {
      name: "mikro-orm",
      recipes: ["mikro-orm"],
      exists: ["src/infrastructure/persistence/mikro-orm/mikro-orm.module.ts"],
      contains: { "src/bootstrap/app.module.ts": ["// import { MikroOrmPersistenceModule }"] },
    },
    {
      name: "drizzle-orm",
      recipes: ["drizzle-orm"],
      exists: [
        "src/infrastructure/persistence/drizzle/drizzle.module.ts",
        "src/infrastructure/persistence/drizzle/drizzle.client.ts",
        "drizzle.config.ts",
      ],
      noDeps: ["better-sqlite3"],
    },
  ],
  reject: [
    {
      name: "type-orm + drizzle-orm",
      recipes: ["type-orm", "drizzle-orm"],
      output: [/conflict/i, /orm/i],
    },
    { name: "zustand (client)", recipes: ["zustand"], output: [/scope 'server'/] },
    { name: "storybook (client)", recipes: ["storybook"] },
  ],
});
