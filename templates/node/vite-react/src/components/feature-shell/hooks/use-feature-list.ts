import { useCallback, useState } from "react";
import { DEFAULT_LIMIT, DEFAULT_PAGE } from "../helpers";
import type { FeatureShellProps, SubListEntry } from "../types";

export function useFeatureList(initialList?: FeatureShellProps["initialList"]) {
  const [searchString, setSearchStringState] = useState(initialList?.searchString);
  const [page, setPage] = useState(initialList?.page ?? DEFAULT_PAGE);
  const [limit, setLimitState] = useState(initialList?.limit ?? DEFAULT_LIMIT);
  const [sub, setSub] = useState(initialList?.sub ?? {});

  const ensureSub = useCallback(
    (key: string, current: typeof sub): SubListEntry =>
      current[key] ?? { page: DEFAULT_PAGE, limit: DEFAULT_LIMIT },
    [],
  );

  const setSearchString = useCallback((next?: string) => {
    setSearchStringState(next);
    setPage(DEFAULT_PAGE);
  }, []);

  const setLimit = useCallback((next: number) => {
    setLimitState(next);
    setPage(DEFAULT_PAGE);
  }, []);

  const setSubSearchString = useCallback(
    (key: string, nextSearch?: string) => {
      setSub((current) => {
        const entry = ensureSub(key, current);
        return { ...current, [key]: { ...entry, searchString: nextSearch, page: DEFAULT_PAGE } };
      });
    },
    [ensureSub],
  );

  const setSubPage = useCallback(
    (key: string, nextPage: number) => {
      setSub((current) => {
        const entry = ensureSub(key, current);
        return { ...current, [key]: { ...entry, page: nextPage } };
      });
    },
    [ensureSub],
  );

  const setSubLimit = useCallback(
    (key: string, nextLimit: number) => {
      setSub((current) => {
        const entry = ensureSub(key, current);
        return { ...current, [key]: { ...entry, limit: nextLimit, page: DEFAULT_PAGE } };
      });
    },
    [ensureSub],
  );

  const setSubEntry = useCallback(
    (key: string, nextPage: number, nextLimit: number, nextSearch?: string) => {
      setSub((current) => ({
        ...current,
        [key]: { page: nextPage, limit: nextLimit, searchString: nextSearch },
      }));
    },
    [],
  );

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
