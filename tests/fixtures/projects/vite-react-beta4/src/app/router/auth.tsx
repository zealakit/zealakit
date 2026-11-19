import { lazy } from "react";
import { Outlet } from "react-router";
import { CONSTANTS } from "@/lib/constants";

const Login = lazy(() => import("@/app/features/auth/login"));
const SignUp = lazy(() => import("@/app/features/auth/sign-up"));
const ForgotPassword = lazy(() => import("@/app/features/auth/forgot-password"));

const AuthLayout = () => <Outlet />;

export const authRoutes = [
  {
    path: CONSTANTS.ROUTES.AUTH.BASE,
    Component: AuthLayout,
    children: [
      { path: CONSTANTS.ROUTES.AUTH.LOGIN, Component: Login },
      { path: CONSTANTS.ROUTES.AUTH.SIGN_UP, Component: SignUp },
      { path: CONSTANTS.ROUTES.AUTH.FORGOT_PASSWORD, Component: ForgotPassword },
    ],
  },
];
