import { Module } from "@nestjs/common";
import { FeatureBController } from "@/presentation/http/api/v1/feature-b/feature-b.controller.js";

@Module({
  controllers: [FeatureBController],
})
export class FeatureBModule {}
