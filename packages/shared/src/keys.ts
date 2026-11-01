/**
 * Natürlicher Schlüssel eines Wortes: dieselbe Schreibung ergibt denselben Schlüssel,
 * egal ob groß/klein, mit arabischen oder persischen Buchstabenvarianten, mit oder ohne
 * Diakritika und Null-Breite-Zeichen. Über (Sprache, Schlüssel) verknüpfen sich eigene
 * Vokabeln, Sammlungen und Wörterbuch auch nachträglich automatisch.
 */
/** Arabische/persische Diakritika (Harakat) und Tatweel. */
export const HARAKAT = /[ً-ٰٟۖ-ۭـ]/g;

export function lemmaKey(text: string): string {
  return text
    .normalize("NFC")
    .replace(HARAKAT, "")
    .replace(/ي/g, "ی")
    .replace(/ى/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌‍‎‏]/g, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Wörter (Unicode-Buchstabenfolgen) aus einem Text, in Reihenfolge, ohne Duplikate (nach Schlüssel). */
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
let jaSegmenter: Intl.Segmenter | null | undefined;

/**
 * Japanisch hat keine Leerzeichen: Läufe aus Kanji/Kana werden mit Intl.Segmenter zerlegt
 * (wörterbuchbasiert, ohne Beugungsanalyse – z. B. 食べました wird nicht immer zu 食べる).
 */
function splitCjk(token: string): string[] {
  if (!CJK.test(token)) return [token];
  if (jaSegmenter === undefined) jaSegmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("ja", { granularity: "word" }) : null;
  if (!jaSegmenter) return [token];
  return [...jaSegmenter.segment(token)].filter((s) => s.isWordLike).map((s) => s.segment);
}

export function tokenize(text: string, limit = 400): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const raws = (text.normalize("NFC").match(/\p{L}[\p{L}\p{M}'’‌-]*/gu) ?? []).flatMap(splitCjk);
  for (const raw of raws) {
    const token = raw.replace(/[-'’‌]+$/u, "");
    const key = lemmaKey(token);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(token);
    if (out.length >= limit) break;
  }
  return out;
}
