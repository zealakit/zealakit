import { Hono } from "hono";
import { createContainer } from "./container.js";
import { createFeatureARoutes } from "./modules/feature-a.js";
import { createFeatureBRoutes } from "./modules/feature-b.js";

export function createApp(): Hono {
  const container = createContainer();
  // strict:false — `/health` and `/health/` both match (browsers often add a trailing slash).
  const app = new Hono({ strict: false });

  app.route("/api/v1/feature-a", createFeatureARoutes(container.featureA));
  app.route("/api/v1/feature-b", createFeatureBRoutes(container.featureB));

  return app;
}
