import { CreateItemHandler } from "@/application/feature-a/handlers/create-item.handler.js";
import { ItemRepositoryAdapter } from "@/infrastructure/persistence/feature-a/item.repository.adapter.js";
import { createFeatureAHttpRoutes } from "@/presentation/http/api/v1/feature-a/feature-a.routes.js";

export function createFeatureA() {
  const itemRepository = new ItemRepositoryAdapter();
  const createItemHandler = new CreateItemHandler(itemRepository);

  return { createItemHandler };
}

export function createFeatureARoutes(deps: ReturnType<typeof createFeatureA>) {
  return createFeatureAHttpRoutes(deps);
}
