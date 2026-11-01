/** Sprachen, die die App kennt. Erweiterbar: neue Sprache = neuer Eintrag + Importdaten. */
export const LANGUAGES = {
  de: { code: "de", name: "Deutsch", nativeName: "Deutsch", dir: "ltr" },
  en: { code: "en", name: "Englisch", nativeName: "English", dir: "ltr" },
  es: { code: "es", name: "Spanisch", nativeName: "Español", dir: "ltr" },
  fa: { code: "fa", name: "Persisch", nativeName: "فارسی", dir: "rtl" },
} as const;

export type LangCode = keyof typeof LANGUAGES;
export const LANG_CODES = Object.keys(LANGUAGES) as LangCode[];

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type Cefr = (typeof CEFR_LEVELS)[number];

export const isLangCode = (value: string): value is LangCode =>
  Object.prototype.hasOwnProperty.call(LANGUAGES, value);

export const cefrIndex = (level: string | null | undefined): number =>
  level ? CEFR_LEVELS.indexOf(level as Cefr) : -1;
