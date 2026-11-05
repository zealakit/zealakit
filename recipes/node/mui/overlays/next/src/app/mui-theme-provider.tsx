"use client";

import { CssBaseline, ThemeProvider } from "@mui/material";
import type { ReactNode } from "react";
import { theme } from "../configs/theme";

type MuiThemeProviderProps = {
  children: ReactNode;
};

/**
 * Client-only theme boundary for App Router.
 * Keep `AppRouterCacheProvider` in `src/app/layout.tsx` (root) — do not nest another cache provider here.
 *
 * Imports `ThemeProvider` / `CssBaseline` from `@mui/material` (not `@/components/ui`) so this
 * overlay typechecks inside the recipe tree; feature screens still use `@/components/ui`.
 */
export const MuiThemeProvider = ({ children }: MuiThemeProviderProps) => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};
