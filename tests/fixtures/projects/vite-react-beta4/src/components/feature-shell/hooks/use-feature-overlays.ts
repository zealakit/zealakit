import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { buildPath, CAPABILITY_BY_OVERLAY, closedOverlays } from "../helpers";
import type {
  EntityId,
  FeatureCapability,
  FeatureRoutes,
  FeatureTitles,
  OverlayController,
  OverlayKey,
  OverlayState,
  ResolvedPresentation,
} from "../types";

type UseFeatureOverlaysOptions<TId extends EntityId> = {
  routes?: FeatureRoutes;
  presentation: ResolvedPresentation;
  titles?: FeatureTitles;
  can: (capability: FeatureCapability | (string & {})) => boolean;
  onDenied?: (capability: FeatureCapability, entityId?: TId) => void;
};

export function useFeatureOverlays<TId extends EntityId = string>({
  routes,
  presentation,
  titles,
  can,
  onDenied,
}: UseFeatureOverlaysOptions<TId>) {
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const routeEntityId = routeId as TId | undefined;
  const [overlays, setOverlays] = useState(() => closedOverlays<TId>());

  const getRouteTemplate = useCallback(
    (key: OverlayKey) => {
      if (key === "deletion" || key === "filter" || key === "upload") {
        return undefined;
      }

      return routes?.[key];
    },
    [routes],
  );

  const closeAllOverlays = useCallback(() => {
    setOverlays(closedOverlays<TId>());
  }, []);

  const goToList = useCallback(() => {
    if (routes?.list) {
      navigate(routes.list);
      return;
    }

    navigate(-1);
  }, [navigate, routes?.list]);

  const openOperation = useCallback(
    (key: OverlayKey, id?: TId) => {
      if (!can(CAPABILITY_BY_OVERLAY[key])) {
        onDenied?.(CAPABILITY_BY_OVERLAY[key], id);
        return;
      }

      if (key !== "deletion" && key !== "filter" && key !== "upload") {
        const config = presentation[key];
        if (config.mode === "route") {
          const path = buildPath(getRouteTemplate(key), id);
          if (path) {
            closeAllOverlays();
            navigate(path);
          }
          return;
        }
      }

      setOverlays({
        ...closedOverlays<TId>(),
        [key]: { isOpen: true, entityId: id } satisfies OverlayState<TId>,
      });
    },
    [can, closeAllOverlays, getRouteTemplate, navigate, onDenied, presentation],
  );

  const closeOperation = useCallback(
    (key: OverlayKey) => {
      if (key !== "deletion" && key !== "filter") {
        const config = presentation[key];
        if (config.mode === "route") {
          goToList();
          return;
        }
      }

      setOverlays((current) => ({ ...current, [key]: { isOpen: false } }));
    },
    [goToList, presentation],
  );

  const makeController = useCallback(
    (key: OverlayKey): OverlayController<TId> => {
      const overlay = overlays[key];
      const config =
        key === "deletion" ? ({ mode: "overlay", variant: "dialog" } as const) : presentation[key];

      return {
        title: titles?.[key],
        mode: config.mode,
        variant: config.variant,
        isOpen: overlay.isOpen,
        entityId: overlay.entityId ?? (config.mode === "route" ? routeEntityId : undefined),
        open: (id?: TId) => openOperation(key, id),
        close: () => closeOperation(key),
      };
    },
    [closeOperation, openOperation, overlays, presentation, routeEntityId, titles],
  );

  const detail = makeController("detail");
  const create = makeController("create");
  const update = makeController("update");
  const upsert = makeController("upsert");

  return {
    filter: makeController("filter"),
    detail: {
      ...detail,
      toCreate: () => openOperation("create"),
      toUpdate: () => openOperation("update", detail.entityId),
      toUpsert: () => openOperation("upsert", detail.entityId),
    },
    create: {
      ...create,
      toDetail: (id: TId) => openOperation("detail", id),
    },
    update: {
      ...update,
      toDetail: (id?: TId) => openOperation("detail", id ?? update.entityId),
    },
    upsert: {
      ...upsert,
      toDetail: (id?: TId) => openOperation("detail", id ?? upsert.entityId),
    },
    upload: makeController("upload"),
    deletion: makeController("deletion"),
  };
}
