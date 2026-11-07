import { createFeatureA } from "./modules/feature-a.js";
import { createFeatureB } from "./modules/feature-b.js";

export type AppContainer = {
  featureA: ReturnType<typeof createFeatureA>;
  featureB: ReturnType<typeof createFeatureB>;
};

/**
 * Composition root — the only place that knows concrete adapters.
 * ORM recipes may import persistence factories here.
 */
export function createContainer(): AppContainer {
  return {
    featureA: createFeatureA(),
    featureB: createFeatureB(),
  };
}
