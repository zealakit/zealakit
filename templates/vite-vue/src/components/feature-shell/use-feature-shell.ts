import { inject } from "vue";
import { featureShellKey } from "./context";
import type { EntityId, FeatureShellContextValue } from "./types";

export function useFeatureShell<TId extends EntityId = string, TFilter = unknown>() {
  const context = inject(featureShellKey);

  if (!context) {
    throw new Error("useFeatureShell must be used within <FeatureShell>.");
  }

  return context as unknown as FeatureShellContextValue<TId, TFilter>;
}
