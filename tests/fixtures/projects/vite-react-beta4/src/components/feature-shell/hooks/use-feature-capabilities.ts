import { useCallback } from "react";
import type { FeatureCapabilities, FeatureCapability } from "../types";

export function useFeatureCapabilities(capabilities: FeatureCapabilities) {
  const can = useCallback(
    (capability: FeatureCapability | (string & {})) => capabilities[capability] !== false,
    [capabilities],
  );

  return { can };
}
