import { defineRecipe, ENABLE_TS_DECORATORS, serverOrmWiring } from "./define.js";

const wiring = serverOrmWiring({
  skill: "type-orm",
  nest: {
    module: "TypeormPersistenceModule",
    from: "@/infrastructure/persistence/typeorm/typeorm.module.js",
  },
  hono: {
    factory: "createTypeOrmDataSource",
    from: "@/infrastructure/persistence/typeorm/typeorm.data-source.js",
    call: "void createTypeOrmDataSource;",
  },
});

export default defineRecipe({
  id: "type-orm",
  name: "TypeORM",
  category: "orm",
  supportedScopes: ["server"],
  exclusive: true,
  packages: {
    typeorm: "^1.1.2",
  },
  overlayPackages: {
    nest: {
      "@nestjs/typeorm": "^12.0.2",
    },
  },
  devDependencies: {},
  scripts: {},
  fileTransforms: {
    nest: wiring.nest,
    hono: [...wiring.hono, ENABLE_TS_DECORATORS],
  },
});
