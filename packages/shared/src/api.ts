import type { CEFR_LEVELS, LangCode } from "./languages.js";

/** Öffentliche API-Typen zwischen Backend und Web-App. */

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  nativeLang: LangCode;
  learnLangs: { lang: LangCode; targetCefr: (typeof CEFR_LEVELS)[number] | null }[];
  /** Öffentliches Profil: auffindbar und ohne Zustimmung folgbar. */
  profilePublic: boolean;
  /** Lernfortschritt für Freunde sichtbar. */
  showProgress: boolean;
}

export type FollowState = "none" | "requested" | "accepted";
export type FriendState = "none" | "outgoing" | "incoming" | "accepted";

export interface PublicUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  isPrivate: boolean;
  /** Nur bei öffentlichen Profilen bzw. für Freunde/Follower gefüllt. */
  bio: string | null;
  stats: { followers: number; following: number; publicCollections: number; verifiedContributions: number } | null;
  progress: { known: number; learning: number } | null;
  relation: { following: FollowState; followedBy: boolean; friend: FriendState };
}

export interface FeedItem {
  type: "collection" | "contribution";
  userId: string;
  userName: string;
  at: number;
  title: string;
  detail: string;
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
  /** Aussprache in lateinischer Umschrift (bei Persisch z. B. "āb"); null, wenn unbekannt. */
  romanization: string | null;
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
  /** Lautschrift aus dem Wörterbuch (z. B. Wiktionary). */
  ipa?: string | null;
  /** Aussprache-Aufnahmen mit freier Lizenz (z. B. Lingua Libre / Wikimedia Commons). */
  audio?: AudioRecording[];
}

export interface AudioRecording {
  url: string;
  license: string | null;
  speaker: string | null;
  region: string | null;
  source: string;
}

export interface CatalogItem {
  lemma: string;
  lang: LangCode;
  lexemeId: number | null;
  gloss: string | null;
  pronunciation?: string | null;
  cefr: string | null;
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
  items?: CatalogItem[];
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

export interface ExtractResult {
  /** Wörter aus dem Text, die im Wörterbuch vorkommen (je Wort eine Lexem-Zeile). */
  matches: LexemeSummary[];
  /** Wörter ohne Treffer. */
  unknown: string[];
  /** Gebeugte Formen aus dem Text je Lexem-ID (z. B. 12 → ["aß"] für „essen“). */
  forms?: Record<number, string[]>;
}
