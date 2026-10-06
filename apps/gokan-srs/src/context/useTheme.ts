import { createContext, useContext } from "react";
import type { Theme } from "../models/theme.model";

interface ThemeProviderState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

/** Kept apart from ThemeProvider so that file exports only a component (React fast refresh). */
export const ThemeContext = createContext<ThemeProviderState>({
    theme: "system",
    setTheme: () => undefined,
});

export const useTheme = (): ThemeProviderState => useContext(ThemeContext);
