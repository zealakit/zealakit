import { App as AntdApp, ConfigProvider } from "antd";
import type { ReactNode } from "react";
import { theme } from "../configs/theme";

type AntdThemeProviderProps = {
  children: ReactNode;
};

/**
 * Wrap individual React islands that need Ant Design — do not hydrate the whole Layout.
 *
 *   import { AntdThemeProvider } from "@/components/antd-theme-provider";
 *   <AntdThemeProvider client:load><YourIsland /></AntdThemeProvider>
 */
export const AntdThemeProvider = ({ children }: AntdThemeProviderProps) => {
  return (
    <ConfigProvider theme={theme}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
};
