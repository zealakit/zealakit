import type {
  EntityId,
  FeatureCapability,
  FeaturePresentation,
  FeatureRoutes,
  OperationPresentation,
  OverlayKey,
  OverlayState,
  PresentableOperation,
  ResolvedPresentation,
} from "./types";

export const PRESENTABLE_OPERATIONS = [
  "filter",
  "detail",
  "create",
  "update",
  "upsert",
  "upload",
] as const satisfies PresentableOperation[];

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 10;

export const DEFAULT_VARIANT = "modal" as const;

export const CAPABILITY_BY_OVERLAY: Record<OverlayKey, FeatureCapability> = {
  filter: "filter",
  detail: "view",
  create: "create",
  update: "update",
  upsert: "upsert",
  upload: "upload",
  deletion: "delete",
};

export function buildPath(template: string | undefined, id?: EntityId): string | undefined {
  if (!template) {
    return undefined;
  }

  if (template.includes(":id")) {
    if (id === undefined) {
      return undefined;
    }

    return template.replaceAll(":id", String(id));
  }

  return template;
}

export function resolvePresentation(
  routes: FeatureRoutes | undefined,
  overrides: FeaturePresentation | undefined,
): ResolvedPresentation {
  const resolved = {} as ResolvedPresentation;

  for (const operation of PRESENTABLE_OPERATIONS) {
    if (operation === "filter" || operation === "upload") {
      const override = overrides?.[operation];
      resolved[operation] = {
        mode: override?.mode ?? "overlay",
        variant: override?.variant ?? DEFAULT_VARIANT,
      };
      continue;
    }

    const override = overrides?.[operation];
    const hasRoute = Boolean(routes?.[operation]);

    const fallback: Required<OperationPresentation> = {
      mode: hasRoute ? "route" : "overlay",
      variant: DEFAULT_VARIANT,
    };

    resolved[operation] = {
      mode: override?.mode ?? fallback.mode,
      variant: override?.variant ?? fallback.variant,
    };
  }

  return resolved;
}

export function emptyOverlay<TId extends EntityId>(): OverlayState<TId> {
  return { isOpen: false };
}

export function closedOverlays<TId extends EntityId>(): Record<
  PresentableOperation | "deletion",
  OverlayState<TId>
> {
  return {
    filter: emptyOverlay<TId>(),
    detail: emptyOverlay<TId>(),
    create: emptyOverlay<TId>(),
    update: emptyOverlay<TId>(),
    upsert: emptyOverlay<TId>(),
    upload: emptyOverlay<TId>(),
    deletion: emptyOverlay<TId>(),
  };
}
