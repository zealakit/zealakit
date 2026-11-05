import type { ItemRepository } from "@/domain/feature-a/repositories/item.repository.js";

/**
 * Application output port. Re-exports the domain repository contract so
 * use-cases depend on the application boundary, not infrastructure.
 */
export type ItemRepositoryPort = ItemRepository;
