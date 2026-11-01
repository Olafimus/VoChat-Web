import { useEffect, useState } from "react";
import { prefs } from "./prefs";

/** Anzeige-Einstellungen für Wörter. Gerätebezogen, werden im Profil gesetzt. */
export interface DisplayPrefs {
  pronunciation: boolean;
  /** Aussprache neben (true) oder unter dem Wort (false). */
  pronunciationInline: boolean;
  gloss: boolean;
  cefr: boolean;
  pos: boolean;
  gender: boolean;
  size: "normal" | "large";
}

export const DEFAULT_DISPLAY: DisplayPrefs = {
  pronunciation: true,
  pronunciationInline: true,
  gloss: true,
  cefr: true,
  pos: false,
  gender: true,
  size: "normal",
};

const KEY = "vochat.display";
const listeners = new Set<() => void>();

export function readDisplay(): DisplayPrefs {
  try {
    const raw = prefs.get(KEY);
    return raw ? { ...DEFAULT_DISPLAY, ...(JSON.parse(raw) as Partial<DisplayPrefs>) } : DEFAULT_DISPLAY;
  } catch {
    return DEFAULT_DISPLAY;
  }
}

export function writeDisplay(next: DisplayPrefs): void {
  prefs.set(KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

/** Liefert die aktuellen Anzeige-Einstellungen und aktualisiert sich bei Änderungen. */
export function useDisplay(): DisplayPrefs {
  const [value, setValue] = useState<DisplayPrefs>(() => readDisplay());
  useEffect(() => {
    const fn = () => setValue(readDisplay());
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return value;
}
