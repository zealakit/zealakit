import { CssBaseline, ThemeProvider } from "@mui/material";
import type { ReactNode } from "react";
import { theme } from "../configs/theme";

type MuiThemeProviderProps = {
  children: ReactNode;
};

/**
 * Wrap individual React islands that need MUI — do not hydrate the whole Layout.
 *
 *   import { MuiThemeProvider } from "@/components/mui-theme-provider";
 *   <MuiThemeProvider client:load><YourIsland /></MuiThemeProvider>
 */
export const MuiThemeProvider = ({ children }: MuiThemeProviderProps) => {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};
