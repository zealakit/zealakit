"use client";

import { useEffect, useState } from "react";
import { getHomeSolutions, type HomeSolutionsData } from "../../_handlers";
import { SolutionsSkeleton } from "./skeleton";
import { SolutionsTemplate } from "./template";

/** CSR export — import this when the section can load after first paint. */
export function Solutions() {
  const [data, setData] = useState<HomeSolutionsData | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getHomeSolutions().then((next) => {
      if (!cancelled) {
        setData(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) {
    return <SolutionsSkeleton />;
  }

  return <SolutionsTemplate {...data} />;
}
