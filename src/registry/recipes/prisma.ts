import { defineRecipe, serverOrmWiring } from "./define.js";

const wiring = serverOrmWiring({
  skill: "prisma",
  nest: {
    module: "PrismaPersistenceModule",
    from: "@/infrastructure/persistence/prisma/prisma.module.js",
  },
  hono: {
    factory: "createPrismaClient",
    from: "@/infrastructure/persistence/prisma/prisma.bootstrap.js",
    call: "createPrismaClient();",
  },
});

export default defineRecipe({
  id: "prisma",
  name: "Prisma",
  hint: "Schema-first ORM",
  category: "orm",
  supportedScopes: ["server", "hybrid"],
  exclusive: true,
  packages: {
    "@prisma/client": "^7.10.1",
  },
  devDependencies: {
    prisma: "^7.10.1",
  },
  scripts: {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
  },
  fileTransforms: wiring,
});
