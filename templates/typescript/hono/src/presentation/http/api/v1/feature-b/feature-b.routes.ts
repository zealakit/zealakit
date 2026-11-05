import { Hono } from "hono";

/**
 * Skeleton HTTP adapter for Feature B.
 * Wire handlers from application/feature-b once use-cases exist.
 */
export function createFeatureBHttpRoutes(): Hono {
  const routes = new Hono({ strict: false });

  routes.get("/health", (c) => c.json({ status: "ok" }));

  return routes;
}
