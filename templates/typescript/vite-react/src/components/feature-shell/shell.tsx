import { useMemo, useState } from "react";
import { FeatureShellContext } from "./context";
import { resolvePresentation } from "./helpers";
import { useFeatureBusy } from "./hooks/use-feature-busy";
import { useFeatureCapabilities } from "./hooks/use-feature-capabilities";
import { useFeatureList } from "./hooks/use-feature-list";
import { useFeatureOverlays } from "./hooks/use-feature-overlays";
import type { EntityId, FeatureShellContextValue, FeatureShellProps } from "./types";

export function FeatureShell<TId extends EntityId = string, TFilter = unknown>({
  children,
  routes,
  presentation: presentationOverrides,
  capabilities = {},
  titles,
  initialTab = "",
  initialFilter,
  initialList,
  onDenied,
}: FeatureShellProps<TId, TFilter>) {
  const presentation = useMemo(
    () => resolvePresentation(routes, presentationOverrides),
    [routes, presentationOverrides],
  );

  const [activeTab, setActiveTab] = useState(initialTab);
  const [filterValue, setFilterValue] = useState<TFilter | undefined>(initialFilter);

  const { can } = useFeatureCapabilities(capabilities);
  const list = useFeatureList(initialList);
  const busy = useFeatureBusy();
  const overlays = useFeatureOverlays<TId>({
    routes,
    presentation,
    titles,
    can,
    onDenied,
  });

  const value = useMemo<FeatureShellContextValue<TId, TFilter>>(
    () => ({
      tab: { activeTab, setActiveTab },
      filter: {
        ...overlays.filter,
        value: filterValue,
        setValue: setFilterValue,
      },
      list,
      detail: overlays.detail,
      create: overlays.create,
      update: overlays.update,
      upsert: overlays.upsert,
      upload: overlays.upload,
      deletion: overlays.deletion,
      download: busy.download,
      capabilities,
      can,
      presentation,
      isCommonLoading: busy.isCommonLoading,
      setIsCommonLoading: busy.setIsCommonLoading,
      runWhileBusy: busy.runWhileBusy,
    }),
    [
      activeTab,
      busy.download,
      busy.isCommonLoading,
      busy.runWhileBusy,
      busy.setIsCommonLoading,
      can,
      capabilities,
      filterValue,
      list,
      overlays.create,
      overlays.deletion,
      overlays.detail,
      overlays.filter,
      overlays.update,
      overlays.upload,
      overlays.upsert,
      presentation,
    ],
  );

  return (
    <FeatureShellContext.Provider
      value={value as unknown as FeatureShellContextValue<EntityId, unknown>}
    >
      {children}
    </FeatureShellContext.Provider>
  );
}
