import { lemmaKey } from "./keys.js";

/**
 * Abgleich einer Wortliste (Lied, Buch, Film, Lernpfad) mit dem eigenen Wortschatz:
 * Welche Wörter sind schon bekannt, welche werden gerade gelernt, welche fehlen?
 * Zuordnung über die Lexem-ID, sonst über Sprache + Wortschlüssel (gleiche Schreibung).
 */

export interface CoverageItem {
  lemma: string;
  lang: string;
  lexemeId?: number | null;
}

export interface CoverageCard {
  lemma: string;
  lang: string;
  lexemeId?: number | null;
  status: "new" | "learning" | "review" | "mastered";
  deleted: boolean;
}

export interface Coverage<T extends CoverageItem> {
  total: number;
  known: number;
  learning: number;
  missing: T[];
  /** Anteil bekannter Wörter (0–1). */
  ratio: number;
}

type State = "known" | "learning";
const wordKey = (lang: string, lemma: string) => `${lang}\u0001${lemmaKey(lemma)}`;

/** Lernstand je Lexem-ID und je Wortschlüssel; "bekannt" gewinnt über "in Arbeit". */
export function cardIndex(cards: CoverageCard[]) {
  const byId = new Map<number, State>();
  const byKey = new Map<string, State>();
  const put = <K>(map: Map<K, State>, k: K, s: State) => {
    if (map.get(k) !== "known") map.set(k, s);
  };
  for (const c of cards) {
    if (c.deleted) continue;
    const s: State = c.status === "review" || c.status === "mastered" ? "known" : "learning";
    if (c.lexemeId) put(byId, c.lexemeId, s);
    put(byKey, wordKey(c.lang, c.lemma), s);
  }
  return {
    stateOf(item: CoverageItem): State | undefined {
      return (item.lexemeId ? byId.get(item.lexemeId) : undefined) ?? byKey.get(wordKey(item.lang, item.lemma));
    },
  };
}

export function coverage<T extends CoverageItem>(items: T[], cards: CoverageCard[]): Coverage<T> {
  const index = cardIndex(cards);
  const seen = new Set<string>();
  let known = 0;
  let learning = 0;
  const missing: T[] = [];
  for (const item of items) {
    const k = item.lexemeId ? `id:${item.lexemeId}` : wordKey(item.lang, item.lemma);
    if (seen.has(k)) continue;
    seen.add(k);
    const s = index.stateOf(item);
    if (s === "known") known++;
    else if (s === "learning") learning++;
    else missing.push(item);
  }
  const total = seen.size;
  return { total, known, learning, missing, ratio: total === 0 ? 0 : known / total };
}
