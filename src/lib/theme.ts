export const THEME_STORAGE_KEY = "pitlane.theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveThemePreference(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return prefersDark ? "dark" : "light";
  return preference;
}

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
