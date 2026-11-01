/** Kleine, geräteweite Einstellungen (z. B. aktive Lernsprache). Fehler werden ignoriert. */
export const prefs = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null): void {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // Storage nicht verfügbar
    }
  },
};
