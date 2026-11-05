import { Controller, Get } from "@nestjs/common";

/**
 * Skeleton HTTP adapter for Feature B.
 * Wire handlers from application/feature-b once use-cases exist.
 */
@Controller({ path: "feature-b", version: "1" })
export class FeatureBController {
  @Get("health")
  health(): { status: string } {
    return { status: "ok" };
  }
}
