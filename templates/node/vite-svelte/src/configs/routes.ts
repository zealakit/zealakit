/** App-level route map. Keep paths out of components. */
export const ROUTES = {
  overview: "/",
  login: "/login",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  featureA: "/feature-a",
  featureADetail: (id: string) => `/feature-a/${id}`,
} as const;
