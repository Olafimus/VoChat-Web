import { prefs } from "./prefs";

export type Theme = "system" | "light" | "dark";
const KEY = "vochat.theme";

export const getTheme = (): Theme => {
  const v = prefs.get(KEY);
  return v === "light" || v === "dark" ? v : "system";
};

/** Setzt das Farbschema auf dem Dokument. "system" folgt den Betriebssystem-Einstellungen. */
export function applyTheme(theme: Theme = getTheme()): void {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme: Theme): void {
  prefs.set(KEY, theme === "system" ? null : theme);
  applyTheme(theme);
}
