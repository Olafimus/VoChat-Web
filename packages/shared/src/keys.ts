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
export function tokenize(text: string, limit = 400): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.normalize("NFC").match(/\p{L}[\p{L}\p{M}'’‌-]*/gu) ?? []) {
    const token = raw.replace(/[-'’‌]+$/u, "");
    const key = lemmaKey(token);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(token);
    if (out.length >= limit) break;
  }
  return out;
}
