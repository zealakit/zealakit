import { reactive, ref } from "vue";
import { DEFAULT_LIMIT, DEFAULT_PAGE } from "../helpers";
import type { FeatureShellProps, SubListEntry } from "../types";

export function useFeatureList(initialList?: FeatureShellProps["initialList"]) {
  const searchString = ref(initialList?.searchString);
  const page = ref(initialList?.page ?? DEFAULT_PAGE);
  const limit = ref(initialList?.limit ?? DEFAULT_LIMIT);
  const sub = reactive<Record<string, SubListEntry>>({ ...(initialList?.sub ?? {}) });

  const ensureSub = (key: string): SubListEntry =>
    sub[key] ?? { page: DEFAULT_PAGE, limit: DEFAULT_LIMIT };

  const setSearchString = (next?: string) => {
    searchString.value = next;
    page.value = DEFAULT_PAGE;
  };

  const setPage = (next: number) => {
    page.value = next;
  };

  const setLimit = (next: number) => {
    limit.value = next;
    page.value = DEFAULT_PAGE;
  };

  const setSubSearchString = (key: string, nextSearch?: string) => {
    const entry = ensureSub(key);
    sub[key] = { ...entry, searchString: nextSearch, page: DEFAULT_PAGE };
  };

  const setSubPage = (key: string, nextPage: number) => {
    const entry = ensureSub(key);
    sub[key] = { ...entry, page: nextPage };
  };

  const setSubLimit = (key: string, nextLimit: number) => {
    const entry = ensureSub(key);
    sub[key] = { ...entry, limit: nextLimit, page: DEFAULT_PAGE };
  };

  const setSubEntry = (key: string, nextPage: number, nextLimit: number, nextSearch?: string) => {
    sub[key] = { page: nextPage, limit: nextLimit, searchString: nextSearch };
  };

  return {
    searchString,
    page,
    limit,
    sub,
    setSearchString,
    setPage,
    setLimit,
    setSubSearchString,
    setSubPage,
    setSubLimit,
    setSub: setSubEntry,
  };
}
