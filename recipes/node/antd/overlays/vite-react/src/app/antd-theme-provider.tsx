import type { ReactNode } from "react";
import { App as AntdApp, ConfigProvider } from "../components/ui";
import { theme } from "../configs/theme";

type AntdThemeProviderProps = {
  children: ReactNode;
};

export const AntdThemeProvider = ({ children }: AntdThemeProviderProps) => {
  return (
    <ConfigProvider theme={theme}>
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
};
