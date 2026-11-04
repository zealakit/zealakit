import { Global, Module } from "@nestjs/common";
import { createPrismaClient } from "./prisma.client.js";
import { PRISMA } from "./prisma.token.js";

@Global()
@Module({
  providers: [
    {
      provide: PRISMA,
      useFactory: () => createPrismaClient(),
    },
  ],
  exports: [PRISMA],
})
export class PrismaPersistenceModule {}
