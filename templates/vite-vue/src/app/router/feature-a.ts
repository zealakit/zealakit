import type { RouteRecordRaw } from "vue-router";
import { CONSTANTS } from "@/lib/constants";

export const featureARoutes: RouteRecordRaw[] = [
  {
    path: CONSTANTS.ROUTES.FEATURE_A.BASE,
    component: () => import("@/app/features/feature-a/shell.vue"),
    children: [
      {
        path: "",
        name: "feature-a-list",
        component: () => import("@/app/features/feature-a/list.vue"),
      },
      {
        path: ":id",
        name: "feature-a-detail",
        component: () => import("@/app/features/feature-a/detail.vue"),
      },
    ],
  },
];
