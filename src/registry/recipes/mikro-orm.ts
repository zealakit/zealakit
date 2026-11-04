import { defineRecipe, ENABLE_TS_DECORATORS, serverOrmWiring } from "./define.js";

const wiring = serverOrmWiring({
  skill: "mikro-orm",
  nest: {
    module: "MikroOrmPersistenceModule",
    from: "@/infrastructure/persistence/mikro-orm/mikro-orm.module.js",
  },
  hono: {
    factory: "createMikroOrm",
    from: "@/infrastructure/persistence/mikro-orm/mikro-orm.bootstrap.js",
    call: "await createMikroOrm();",
  },
});

export default defineRecipe({
  id: "mikro-orm",
  name: "MikroORM",
  category: "orm",
  supportedScopes: ["server", "hybrid"],
  exclusive: true,
  packages: {
    "@mikro-orm/core": "^7.2.6",
    "@mikro-orm/decorators": "^7.2.6",
  },
  overlayPackages: {
    nest: {
      "@mikro-orm/nestjs": "^7.1.0",
    },
  },
  devDependencies: {},
  scripts: {},
  fileTransforms: {
    nest: wiring.nest,
    hono: [...wiring.hono, ENABLE_TS_DECORATORS],
    next: [ENABLE_TS_DECORATORS],
  },
});
