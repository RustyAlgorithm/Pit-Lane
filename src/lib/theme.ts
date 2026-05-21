/**
 * @file theme.ts
 * @description Theme management utilities for light/dark mode support.
 * Handles theme preference storage, resolution based on system settings, and DOM manipulation.
 */

/** LocalStorage key for persisting theme preference */
export const THEME_STORAGE_KEY = "pitlane.theme";

/** User's explicit theme preference or system default */
export type ThemePreference = "light" | "dark" | "system";

/** The actual resolved theme that should be applied (light or dark, never system) */
export type ResolvedTheme = "light" | "dark";

/**
 * Type guard to validate that a string is a valid theme preference.
 * 
 * @param value String to check
 * @returns True if value is 'light', 'dark', or 'system'
 */
export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Resolve a theme preference to an actual theme (light or dark).
 * If preference is 'system', uses the system color scheme preference.
 * 
 * @param preference User's theme preference
 * @param prefersDark Whether the system prefers dark mode
 * @returns The resolved theme (light or dark)
 */
export function resolveThemePreference(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

/**
 * Apply the resolved theme to the DOM and document element.
 * Sets CSS classes, color scheme, and data attributes for styling.
 * 
 * @param preference User's theme preference
 * @param resolved The actual resolved theme to apply
 */
export function applyResolvedTheme(
  preference: ThemePreference,
  resolved: ResolvedTheme,
) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  root.dataset.theme = resolved;
  root.dataset.themePreference = preference;
}

/**
 * Get an initialization script for theme setup that runs before React hydration.
 * This prevents flash of wrong theme on page load by applying theme synchronously.
 * 
 * @returns JavaScript code to be executed in <script> tag in document head
 */
export function getThemeInitScript() {
  return `
    (() => {
      try {
        const storageKey = ${JSON.stringify(THEME_STORAGE_KEY)};
        const stored = window.localStorage.getItem(storageKey);
        const preference =
          stored === "light" || stored === "dark" || stored === "system"
            ? stored
            : "system";
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const resolved = preference === "system"
          ? (prefersDark ? "dark" : "light")
          : preference;
        const root = document.documentElement;
        root.classList.toggle("dark", resolved === "dark");
        root.style.colorScheme = resolved;
        root.dataset.theme = resolved;
        root.dataset.themePreference = preference;
      } catch {}
    })();
  `;
}
