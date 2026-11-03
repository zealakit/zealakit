import { computed, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
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
  const router = useRouter();
  const route = useRoute();
  const overlays = reactive(closedOverlays<TId>()) as ReturnType<typeof closedOverlays<TId>>;

  const routeEntityId = computed(() => route.params.id as TId | undefined);

  const getRouteTemplate = (key: OverlayKey) => {
    if (key === "deletion" || key === "filter" || key === "upload") {
      return undefined;
    }

    return routes?.[key];
  };

  const closeAllOverlays = () => {
    Object.assign(overlays, closedOverlays<TId>());
  };

  const goToList = () => {
    if (routes?.list) {
      void router.push(routes.list);
      return;
    }

    void router.back();
  };

  const openOperation = (key: OverlayKey, id?: TId) => {
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
          void router.push(path);
        }
        return;
      }
    }

    Object.assign(overlays, closedOverlays<TId>());
    overlays[key] = { isOpen: true, entityId: id } as OverlayState<TId>;
  };

  const closeOperation = (key: OverlayKey) => {
    if (key !== "deletion" && key !== "filter") {
      const config = presentation[key];
      if (config.mode === "route") {
        goToList();
        return;
      }
    }

    overlays[key] = { isOpen: false };
  };

  const makeController = (key: OverlayKey): OverlayController<TId> => {
    const overlay = overlays[key];
    const config =
      key === "deletion" ? ({ mode: "overlay", variant: "dialog" } as const) : presentation[key];

    return {
      title: titles?.[key],
      mode: config.mode,
      variant: config.variant,
      isOpen: overlay.isOpen,
      entityId: overlay.entityId ?? (config.mode === "route" ? routeEntityId.value : undefined),
      open: (id?: TId) => openOperation(key, id),
      close: () => closeOperation(key),
    };
  };

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
