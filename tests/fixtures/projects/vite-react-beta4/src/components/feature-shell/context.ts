import { createContext } from "react";
import type { EntityId, FeatureShellContextValue } from "./types";

export const FeatureShellContext = createContext<FeatureShellContextValue<
  EntityId,
  unknown
> | null>(null);
