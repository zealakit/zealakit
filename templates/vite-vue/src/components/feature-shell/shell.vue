<script setup lang="ts" generic="TId extends EntityId = string, TFilter = unknown">
import { computed, provide, reactive, ref } from "vue";
import { featureShellKey } from "./context";
import { resolvePresentation } from "./helpers";
import { useFeatureBusy } from "./composables/use-feature-busy";
import { useFeatureCapabilities } from "./composables/use-feature-capabilities";
import { useFeatureList } from "./composables/use-feature-list";
import { useFeatureOverlays } from "./composables/use-feature-overlays";
import type {
  EntityId,
  FeatureCapabilities,
  FeatureCapability,
  FeaturePresentation,
  FeatureRoutes,
  FeatureShellContextValue,
  FeatureTitles,
  ListState,
  SubList,
} from "./types";

const props = withDefaults(
  defineProps<{
    routes?: FeatureRoutes;
    presentation?: FeaturePresentation;
    capabilities?: FeatureCapabilities;
    titles?: FeatureTitles;
    initialTab?: string;
    initialFilter?: TFilter;
    initialList?: Partial<Omit<ListState, "sub">> & { sub?: SubList };
    onDenied?: (capability: FeatureCapability, entityId?: TId) => void;
  }>(),
  {
    capabilities: () => ({}),
    initialTab: "",
  },
);

const presentation = computed(() => resolvePresentation(props.routes, props.presentation));

const activeTab = ref(props.initialTab);
const filterValue = ref<TFilter | undefined>(props.initialFilter);

const { can } = useFeatureCapabilities(props.capabilities);
const listApi = useFeatureList(props.initialList);
const busy = useFeatureBusy();
const overlays = useFeatureOverlays<TId>({
  routes: props.routes,
  presentation: presentation.value,
  titles: props.titles,
  can,
  onDenied: props.onDenied,
});

const context = reactive({
  tab: {
    get activeTab() {
      return activeTab.value;
    },
    setActiveTab: (tab: string) => {
      activeTab.value = tab;
    },
  },
  filter: {
    get isOpen() {
      return overlays.filter.isOpen;
    },
    get entityId() {
      return overlays.filter.entityId;
    },
    get title() {
      return overlays.filter.title;
    },
    get mode() {
      return overlays.filter.mode;
    },
    get variant() {
      return overlays.filter.variant;
    },
    open: (id?: TId) => overlays.filter.open(id),
    close: () => overlays.filter.close(),
    get value() {
      return filterValue.value;
    },
    setValue: (next?: TFilter) => {
      filterValue.value = next;
    },
  },
  list: {
    get searchString() {
      return listApi.searchString.value;
    },
    get page() {
      return listApi.page.value;
    },
    get limit() {
      return listApi.limit.value;
    },
    get sub() {
      return listApi.sub;
    },
    setSearchString: listApi.setSearchString,
    setPage: listApi.setPage,
    setLimit: listApi.setLimit,
    setSubSearchString: listApi.setSubSearchString,
    setSubPage: listApi.setSubPage,
    setSubLimit: listApi.setSubLimit,
    setSub: listApi.setSub,
  },
  detail: {
    get isOpen() {
      return overlays.detail.isOpen;
    },
    get entityId() {
      return overlays.detail.entityId;
    },
    get title() {
      return overlays.detail.title;
    },
    get mode() {
      return overlays.detail.mode;
    },
    get variant() {
      return overlays.detail.variant;
    },
    open: (id?: TId) => overlays.detail.open(id),
    close: () => overlays.detail.close(),
    toCreate: () => overlays.detail.toCreate(),
    toUpdate: () => overlays.detail.toUpdate(),
    toUpsert: () => overlays.detail.toUpsert(),
  },
  create: {
    get isOpen() {
      return overlays.create.isOpen;
    },
    get entityId() {
      return overlays.create.entityId;
    },
    get title() {
      return overlays.create.title;
    },
    get mode() {
      return overlays.create.mode;
    },
    get variant() {
      return overlays.create.variant;
    },
    open: (id?: TId) => overlays.create.open(id),
    close: () => overlays.create.close(),
    toDetail: (id: TId) => overlays.create.toDetail(id),
  },
  update: {
    get isOpen() {
      return overlays.update.isOpen;
    },
    get entityId() {
      return overlays.update.entityId;
    },
    get title() {
      return overlays.update.title;
    },
    get mode() {
      return overlays.update.mode;
    },
    get variant() {
      return overlays.update.variant;
    },
    open: (id?: TId) => overlays.update.open(id),
    close: () => overlays.update.close(),
    toDetail: (id?: TId) => overlays.update.toDetail(id),
  },
  upsert: {
    get isOpen() {
      return overlays.upsert.isOpen;
    },
    get entityId() {
      return overlays.upsert.entityId;
    },
    get title() {
      return overlays.upsert.title;
    },
    get mode() {
      return overlays.upsert.mode;
    },
    get variant() {
      return overlays.upsert.variant;
    },
    open: (id?: TId) => overlays.upsert.open(id),
    close: () => overlays.upsert.close(),
    toDetail: (id?: TId) => overlays.upsert.toDetail(id),
  },
  upload: {
    get isOpen() {
      return overlays.upload.isOpen;
    },
    get entityId() {
      return overlays.upload.entityId;
    },
    get title() {
      return overlays.upload.title;
    },
    get mode() {
      return overlays.upload.mode;
    },
    get variant() {
      return overlays.upload.variant;
    },
    open: (id?: TId) => overlays.upload.open(id),
    close: () => overlays.upload.close(),
  },
  deletion: {
    get isOpen() {
      return overlays.deletion.isOpen;
    },
    get entityId() {
      return overlays.deletion.entityId;
    },
    get title() {
      return overlays.deletion.title;
    },
    get mode() {
      return overlays.deletion.mode;
    },
    get variant() {
      return overlays.deletion.variant;
    },
    open: (id?: TId) => overlays.deletion.open(id),
    close: () => overlays.deletion.close(),
  },
  download: {
    get isLoading() {
      return busy.download.isLoading.value;
    },
    setIsLoading: busy.download.setIsLoading,
  },
  capabilities: props.capabilities,
  can,
  get presentation() {
    return presentation.value;
  },
  get isCommonLoading() {
    return busy.isCommonLoading.value;
  },
  setIsCommonLoading: busy.setIsCommonLoading,
  runWhileBusy: busy.runWhileBusy,
}) as FeatureShellContextValue<TId, TFilter>;

provide(featureShellKey, context as unknown as FeatureShellContextValue<EntityId, unknown>);
</script>

<template>
  <slot />
</template>
