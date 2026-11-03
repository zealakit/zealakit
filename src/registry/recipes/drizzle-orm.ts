import { defineRecipe, serverOrmWiring } from "./define.js";

const wiring = serverOrmWiring({
  skill: "drizzle-orm",
  nest: {
    module: "DrizzlePersistenceModule",
    from: "@/infrastructure/persistence/drizzle/drizzle.module.js",
  },
  hono: {
    factory: "createDrizzleClient",
    from: "@/infrastructure/persistence/drizzle/drizzle.bootstrap.js",
    call: "createDrizzleClient();",
  },
});

export default defineRecipe({
  id: "drizzle-orm",
  name: "Drizzle ORM",
  hint: "Lightweight SQL",
  category: "orm",
  supportedScopes: ["server"],
  exclusive: true,
  packages: {
    "drizzle-orm": "^0.45.4",
  },
  devDependencies: {
    "drizzle-kit": "^0.31.11",
  },
  scripts: {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
  },
  fileTransforms: wiring,
});
