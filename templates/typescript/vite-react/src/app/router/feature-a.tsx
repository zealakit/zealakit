import { lazy } from "react";
import { CONSTANTS } from "@/lib/constants";

const FeatureAList = lazy(() => import("@/app/features/feature-a/list"));
const FeatureADetail = lazy(() => import("@/app/features/feature-a/detail"));
const FeatureAShell = lazy(() => import("@/app/features/feature-a/shell"));

export const featureARoutes = [
  {
    path: CONSTANTS.ROUTES.FEATURE_A.BASE,
    Component: FeatureAShell,
    children: [
      { index: true, Component: FeatureAList },
      { path: ":id", Component: FeatureADetail },
    ],
  },
];
