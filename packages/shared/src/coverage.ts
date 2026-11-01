/**
 * Abgleich eines Textes (Lied, Buch, Film, Lernpfad) mit dem eigenen Wortschatz:
 * Welche Wörter sind schon bekannt, welche werden gerade gelernt, welche fehlen?
 */

export interface CoverageItem {
  lemma: string;
  lang: string;
}

export interface CoverageCard {
  lemma: string;
  lang: string;
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

const key = (lang: string, lemma: string) => `${lang}\u0001${lemma.trim().toLocaleLowerCase("de")}`;

export function coverage<T extends CoverageItem>(items: T[], cards: CoverageCard[]): Coverage<T> {
  const state = new Map<string, "known" | "learning">();
  for (const c of cards) {
    if (c.deleted) continue;
    const k = key(c.lang, c.lemma);
    const next = c.status === "review" || c.status === "mastered" ? "known" : "learning";
    if (state.get(k) !== "known") state.set(k, next);
  }
  const seen = new Set<string>();
  let known = 0;
  let learning = 0;
  const missing: T[] = [];
  for (const item of items) {
    const k = key(item.lang, item.lemma);
    if (seen.has(k)) continue;
    seen.add(k);
    const s = state.get(k);
    if (s === "known") known++;
    else if (s === "learning") learning++;
    else missing.push(item);
  }
  const total = seen.size;
  return { total, known, learning, missing, ratio: total === 0 ? 0 : known / total };
}
