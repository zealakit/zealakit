import type { RouteRecordRaw } from "vue-router";
import { CONSTANTS } from "@/lib/constants";

export const authRoutes: RouteRecordRaw[] = [
  {
    path: CONSTANTS.ROUTES.AUTH.BASE,
    children: [
      {
        path: CONSTANTS.ROUTES.AUTH.LOGIN,
        name: "auth-login",
        component: () => import("@/app/features/auth/login.vue"),
      },
      {
        path: CONSTANTS.ROUTES.AUTH.SIGN_UP,
        name: "auth-sign-up",
        component: () => import("@/app/features/auth/sign-up.vue"),
      },
      {
        path: CONSTANTS.ROUTES.AUTH.FORGOT_PASSWORD,
        name: "auth-forgot-password",
        component: () => import("@/app/features/auth/forgot-password.vue"),
      },
    ],
  },
];
