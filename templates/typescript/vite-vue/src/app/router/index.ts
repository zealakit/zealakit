import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { authRoutes } from "./auth";
import { featureARoutes } from "./feature-a";
import { featureBRoutes } from "./feature-b";
import { overviewRoutes } from "./overview";

export const routes: RouteRecordRaw[] = [
  {
    path: "/",
    children: [...overviewRoutes, ...authRoutes, ...featureARoutes, ...featureBRoutes],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
