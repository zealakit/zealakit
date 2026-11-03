import type { FeatureCapabilities, FeatureCapability } from "../types";

export function useFeatureCapabilities(capabilities: FeatureCapabilities) {
  const can = (capability: FeatureCapability | (string & {})) =>
    capabilities[capability] !== false;

  return { can };
}
