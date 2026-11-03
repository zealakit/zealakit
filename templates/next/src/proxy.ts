import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Exclude `/api/*` (and static internals) so Route Handlers are not redirected to `/[locale]/…`.
  // Keep `api` in this negative lookahead when adding more App Router APIs.
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
