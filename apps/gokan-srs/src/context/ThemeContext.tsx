import { useEffect, useState } from "react";
import type { Theme } from "../models/theme.model";
import { StorageService } from "../services/storage.service";
import { ThemeContext } from "./useTheme";

interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
}

export function ThemeProvider({ children, defaultTheme = "system" }: ThemeProviderProps) {
    const [theme, setTheme] = useState<Theme>(() => StorageService.loadTheme() ?? defaultTheme);

    useEffect(() => {
        const root = window.document.documentElement;

        root.classList.remove("light", "dark");

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
                .matches
                ? "dark"
                : "light";

            root.classList.add(systemTheme);
            return;
        }

        root.classList.add(theme);
    }, [theme]);

    const value = {
        theme,
        setTheme: (next: Theme) => {
            StorageService.saveTheme(next);
            setTheme(next);
        },
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}
