import type { InjectionKey } from "vue";
import type { EntityId, FeatureShellContextValue } from "./types";

export const featureShellKey: InjectionKey<FeatureShellContextValue<EntityId, unknown>> =
  Symbol("feature-shell");
