import { createFeatureBHttpRoutes } from "@/presentation/http/api/v1/feature-b/feature-b.routes.js";

/**
 * Skeleton composition for Feature B.
 * Wire handlers from application/feature-b once use-cases exist.
 */
export function createFeatureB() {
  return {};
}

export function createFeatureBRoutes(_deps: ReturnType<typeof createFeatureB>) {
  return createFeatureBHttpRoutes();
}
