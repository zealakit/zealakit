/**
 * Port identity keys for Feature A.
 * Use these when documenting or mapping ports in the composition root
 * (`bootstrap/modules/feature-a.ts`). Handlers take constructor deps, not a DI container.
 */
export const FEATURE_A_TOKENS = {
  ITEM_REPOSITORY: Symbol.for("feature-a.ItemRepository"),
} as const;
