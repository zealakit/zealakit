/**
 * NestJS injection tokens for Feature A output ports.
 * Infrastructure adapters bind to these tokens in FeatureAModule.
 */
export const FEATURE_A_TOKENS = {
  ITEM_REPOSITORY: Symbol.for("feature-a.ItemRepository"),
} as const;
