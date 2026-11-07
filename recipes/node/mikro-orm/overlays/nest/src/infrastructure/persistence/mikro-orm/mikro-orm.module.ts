import { Module } from "@nestjs/common";
import { MikroOrmModule } from "@mikro-orm/nestjs";
import { createMikroOrmOptions } from "./mikro-orm.options.js";

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      useFactory: () => createMikroOrmOptions(),
    }),
  ],
  exports: [MikroOrmModule],
})
export class MikroOrmPersistenceModule {}
