import { lazy } from "react";

const Overview = lazy(() => import("@/app/features/overview/overview"));

export const overviewRoutes = [
  {
    index: true,
    Component: Overview,
  },
];
