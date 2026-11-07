import type { ReactNode } from "react";
import { CssBaseline, ThemeProvider } from "../components/ui";
import { theme } from "../configs/theme";

type MuiThemeProviderProps = {
  children: ReactNode;
};

export const MuiThemeProvider = ({ children }: MuiThemeProviderProps) => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};
