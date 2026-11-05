import { Module } from "@nestjs/common";
import { CreateItemHandler } from "@/application/feature-a/handlers/create-item.handler.js";
import { FEATURE_A_TOKENS } from "@/application/feature-a/tokens/feature-a.tokens.js";
import { ItemRepositoryAdapter } from "@/infrastructure/persistence/feature-a/item.repository.adapter.js";
import { FeatureAController } from "@/presentation/http/api/v1/feature-a/feature-a.controller.js";

@Module({
  controllers: [FeatureAController],
  providers: [
    CreateItemHandler,
    {
      provide: FEATURE_A_TOKENS.ITEM_REPOSITORY,
      useClass: ItemRepositoryAdapter,
    },
  ],
  exports: [FEATURE_A_TOKENS.ITEM_REPOSITORY],
})
export class FeatureAModule {}
