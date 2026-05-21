/**
 * @file ThemeProvider.tsx
 * @description React context provider for managing light/dark theme.
 * Handles theme preference persistence, system preference detection, and DOM updates.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ResolvedTheme, ThemePreference } from "@/lib/theme";
import {
  THEME_STORAGE_KEY,
  applyResolvedTheme,
  isThemePreference,
  resolveThemePreference,
} from "@/lib/theme";

/**
 * Theme context value containing current theme state and controls.
 */
interface ThemeContextValue {
  /** User's explicit theme preference (light, dark, or system) */
  theme: ThemePreference;
  /** Resolved theme after applying system preference if needed (light or dark) */
  resolvedTheme: ResolvedTheme;
  /** Function to change theme preference */
  setTheme: (theme: ThemePreference) => void;
  /** Function to toggle between light and dark (respecting system if current is system) */
  toggleTheme: () => void;
}

/** React context for theme management */
const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Get the initial theme preference from the DOM.
 * Set during server-side rendering via getThemeInitScript().
 * 
 * @returns Stored theme preference or default 'system'
 */
function getInitialThemePreference(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const preference = document.documentElement.dataset.themePreference ?? null;
  return isThemePreference(preference) ? preference : "system";
}

/**
 * Get the initially resolved theme from the DOM.
 * Set during server-side rendering via getThemeInitScript().
 * 
 * @returns Resolved theme (light or dark)
 */
function getInitialResolvedTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Provider component that wraps the app with theme management.
 * Handles theme synchronization with system preferences and DOM updates.
 * 
 * @param children Child components to wrap
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>(getInitialThemePreference);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(getInitialResolvedTheme);

  // Sync theme with localStorage and apply to DOM
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const syncTheme = () => {
      const resolved = resolveThemePreference(theme, media.matches);
      applyResolvedTheme(theme, resolved);
      setResolvedTheme(resolved);
    };

    syncTheme();

    // Persist preference to localStorage
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}

    // Listen for system theme changes (only if using system preference)
    const handleChange = () => {
      if (theme !== "system") return;
      syncTheme();
    };

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      // Toggle between light/dark, or switch from system to opposite of current resolved
      toggleTheme: () =>
        setTheme((current) => {
          if (current === "system") return resolvedTheme === "dark" ? "light" : "dark";
          return current === "dark" ? "light" : "dark";
        }),
    }),
    [resolvedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access theme context.
 * Must be used within ThemeProvider.
 * 
 * @returns Theme context value with state and controls
 * @throws Error if used outside ThemeProvider
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
