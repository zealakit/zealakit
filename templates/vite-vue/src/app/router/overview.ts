import type { RouteRecordRaw } from "vue-router";

export const overviewRoutes: RouteRecordRaw[] = [
  {
    path: "",
    name: "overview",
    component: () => import("@/app/features/overview/overview.vue"),
  },
];
