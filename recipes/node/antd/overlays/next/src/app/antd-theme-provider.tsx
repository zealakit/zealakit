"use client";

import { App as AntdApp, ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { theme } from "../configs/theme";

type AntdThemeProviderProps = {
  children: ReactNode;
};

/**
 * Client-only theme boundary for App Router.
 * Keep `AntdRegistry` in `src/app/layout.tsx` (root) — do not nest another registry here.
 *
 * Imports `ConfigProvider` / `App` from `antd` (not `@/components/ui`) so this overlay
 * typechecks inside the recipe tree; feature screens still use `@/components/ui`.
 */
export const AntdThemeProvider = ({ children }: AntdThemeProviderProps) => {
  return (
    <ConfigProvider theme={theme}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
};
