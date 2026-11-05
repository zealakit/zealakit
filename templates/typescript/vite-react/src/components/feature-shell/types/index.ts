import type { ReactNode } from "react";

export type EntityId = string | number;

/**
 * Visual treatment for an overlay. FeatureShell is headless — it only stores
 * this so the consumer can render modal / drawer / sheet / dialog / popup.
 */
export type OverlayVariant = "modal" | "drawer" | "sheet" | "dialog" | "popup";

export type PresentationMode = "route" | "overlay";

export type OperationPresentation = {
  mode: PresentationMode;
  /** Used when `mode` is `"overlay"`. Defaults to `"modal"`. */
  variant?: OverlayVariant;
};

export type PresentableOperation = "filter" | "detail" | "create" | "update" | "upsert" | "upload";

export type OverlayKey = PresentableOperation | "deletion";

export type FeaturePresentation = Partial<Record<PresentableOperation, OperationPresentation>>;

export type ResolvedPresentation = Record<PresentableOperation, Required<OperationPresentation>>;

/**
 * Path templates. Use `:id` for entity id interpolation.
 *
 * @example
 * {
 *   list: "/feature-a",
 *   detail: "/feature-a/:id",
 *   create: "/feature-a/create",
 *   update: "/feature-a/:id/edit",
 * }
 */
export type FeatureRoutes = {
  list?: string;
  detail?: string;
  create?: string;
  update?: string;
  upsert?: string;
};

export type FeatureTitles = {
  filter?: string;
  detail?: string;
  create?: string;
  update?: string;
  upsert?: string;
  upload?: string;
  deletion?: string;
};

/**
 * Permission / entitlement flags. Missing keys default to allowed (`true`)
 * so a feature works before auth is wired. Set `false` to hide and block.
 */
export type FeatureCapability =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "upsert"
  | "filter"
  | "upload"
  | "download";

export type FeatureCapabilities = {
  [K in FeatureCapability]?: boolean;
} & {
  [key: string]: boolean | undefined;
};

export type SubListEntry = {
  searchString?: string;
  page: number;
  limit: number;
};

export type SubList = Record<string, SubListEntry>;

export type OverlayState<TId extends EntityId = string> = {
  isOpen: boolean;
  entityId?: TId;
};

export type OverlayController<TId extends EntityId = string> = OverlayState<TId> & {
  title?: string;
  mode: PresentationMode;
  variant: OverlayVariant;
  open: (id?: TId) => void;
  close: () => void;
};

export type ListState = {
  searchString?: string;
  page: number;
  limit: number;
  sub: SubList;
};

export type FeatureShellContextValue<TId extends EntityId = string, TFilter = unknown> = {
  tab: {
    activeTab: string;
    setActiveTab: (tab: string) => void;
  };
  filter: OverlayController<TId> & {
    value?: TFilter;
    setValue: (next?: TFilter) => void;
  };
  list: ListState & {
    setSearchString: (searchString?: string) => void;
    setPage: (page: number) => void;
    setLimit: (limit: number) => void;
    setSubSearchString: (key: string, searchString?: string) => void;
    setSubPage: (key: string, page: number) => void;
    setSubLimit: (key: string, limit: number) => void;
    setSub: (key: string, page: number, limit: number, searchString?: string) => void;
  };
  detail: OverlayController<TId> & {
    toCreate: () => void;
    toUpdate: () => void;
    toUpsert: () => void;
  };
  create: OverlayController<TId> & {
    toDetail: (id: TId) => void;
  };
  update: OverlayController<TId> & {
    toDetail: (id?: TId) => void;
  };
  upsert: OverlayController<TId> & {
    toDetail: (id?: TId) => void;
  };
  upload: OverlayController<TId>;
  deletion: OverlayController<TId>;
  download: {
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
  };
  capabilities: FeatureCapabilities;
  can: (capability: FeatureCapability | (string & {})) => boolean;
  presentation: ResolvedPresentation;
  /**
   * Shared busy flag for sequential work (e.g. chained API calls) so the
   * layout does not flicker between multiple local loading states.
   */
  isCommonLoading: boolean;
  setIsCommonLoading: (loading: boolean) => void;
  runWhileBusy: <T>(task: () => Promise<T>) => Promise<T>;
};

export type FeatureShellProps<TId extends EntityId = string, TFilter = unknown> = {
  children: ReactNode;
  routes?: FeatureRoutes;
  presentation?: FeaturePresentation;
  capabilities?: FeatureCapabilities;
  titles?: FeatureTitles;
  initialTab?: string;
  initialFilter?: TFilter;
  initialList?: Partial<Omit<ListState, "sub">> & { sub?: SubList };
  onDenied?: (capability: FeatureCapability, entityId?: TId) => void;
};
