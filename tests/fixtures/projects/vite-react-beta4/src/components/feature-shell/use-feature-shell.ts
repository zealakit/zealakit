import { useContext } from "react";
import { FeatureShellContext } from "./context";
import type { EntityId, FeatureShellContextValue } from "./types";

export function useFeatureShell<TId extends EntityId = string, TFilter = unknown>() {
  const context = useContext(FeatureShellContext);

  if (!context) {
    throw new Error("useFeatureShell must be used within <FeatureShell>.");
  }

  return context as unknown as FeatureShellContextValue<TId, TFilter>;
}
