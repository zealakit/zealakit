import type { RouteRecordRaw } from "vue-router";
import { CONSTANTS } from "@/lib/constants";

/** Feature B mirrors Feature A routes but skips FeatureShell / shell.vue. */
export const featureBRoutes: RouteRecordRaw[] = [
  {
    path: CONSTANTS.ROUTES.FEATURE_B.BASE,
    children: [
      {
        path: "",
        name: "feature-b-list",
        component: () => import("@/app/features/feature-b/list.vue"),
      },
      {
        path: ":id",
        name: "feature-b-detail",
        component: () => import("@/app/features/feature-b/detail.vue"),
      },
    ],
  },
];
