import { Module } from "@nestjs/common";
import { FeatureAModule } from "./modules/feature-a.module.js";
import { FeatureBModule } from "./modules/feature-b.module.js";

@Module({
  imports: [FeatureAModule, FeatureBModule],
})
export class AppModule {}
