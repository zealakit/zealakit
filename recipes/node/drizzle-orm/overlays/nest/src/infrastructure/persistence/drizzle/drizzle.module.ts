import { Global, Module } from "@nestjs/common";
import { createDrizzleClient } from "./drizzle.client.js";
import { DRIZZLE } from "./drizzle.token.js";

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: () => createDrizzleClient(),
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzlePersistenceModule {}
