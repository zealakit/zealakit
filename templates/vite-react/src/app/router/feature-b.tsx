import { lazy } from "react";
import { Outlet } from "react-router";
import { CONSTANTS } from "@/lib/constants";

const FeatureBList = lazy(() => import("@/app/features/feature-b/list"));
const FeatureBDetail = lazy(() => import("@/app/features/feature-b/detail"));

/** Feature B mirrors Feature A routes but skips `FeatureShell` / `shell.tsx`. */
export const featureBRoutes = [
  {
    path: CONSTANTS.ROUTES.FEATURE_B.BASE,
    Component: Outlet,
    children: [
      { index: true, Component: FeatureBList },
      { path: ":id", Component: FeatureBDetail },
    ],
  },
];
