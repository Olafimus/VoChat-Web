import type { CEFR_LEVELS, LangCode } from "./languages.js";

/** Öffentliche API-Typen zwischen Backend und Web-App. */

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  nativeLang: LangCode;
  learnLangs: { lang: LangCode; targetCefr: (typeof CEFR_LEVELS)[number] | null }[];
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

export interface LexemeSummary {
  id: number;
  lang: LangCode;
  lemma: string;
  pos: string | null;
  gender: string | null;
  cefr: string | null;
  frequencyRank: number | null;
  /** Erste Übersetzung/Gloss in der Sprache des Nutzers, falls vorhanden. */
  gloss: string | null;
}

export interface Sense {
  position: number;
  glossLang: string;
  gloss: string;
  source: string;
}

export interface Example {
  text: string;
  translation: string | null;
  translationLang: string | null;
  source: string;
}

export interface Translation {
  targetLang: LangCode;
  targetLemma: string;
  source: string;
}

export interface LexemeDetail extends LexemeSummary {
  romanization: string | null;
  senses: Sense[];
  examples: Example[];
  translations: Translation[];
  categories: { name: string; kind: string }[];
}

export interface CatalogCollection {
  id: string;
  kind: "path" | "media";
  mediaType: string | null;
  title: string;
  description: string;
  lang: LangCode;
  level: (typeof CEFR_LEVELS)[number] | null;
  ownerName: string;
  itemCount: number;
  rating: { average: number | null; count: number };
  items?: { lemma: string; lang: LangCode; lexemeId: number | null; gloss: string | null; cefr: string | null }[];
}

export interface SyncChange {
  entity: "cards" | "messages" | "reviews" | "collections";
  row: Record<string, unknown>;
}

export interface PullResponse {
  changes: SyncChange[];
  cursor: number;
  hasMore: boolean;
}

export interface PushResponse {
  accepted: number;
  rejected: { id: string; reason: string }[];
  cursor: number;
}
