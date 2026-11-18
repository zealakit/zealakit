import { APIS } from "./apis";
import * as locales from "./locales";
import * as routes from "./routes";
import { STORAGE } from "./storage";

export const CONSTANTS = {
  ROUTES: routes,
  LOCALES: locales,
  STORAGE: STORAGE,
  APIS: APIS,
} as const;
