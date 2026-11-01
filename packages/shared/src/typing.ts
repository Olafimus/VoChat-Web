/**
 * Antwortprüfung für das Tippen. Tippfehler werden toleriert: erlaubt ist
 * höchstens ein Fehler je 10 Zeichen (floor(len/10)). Kurze Wörter müssen exakt stimmen.
 */

// Arabische/persische Diakritika (Harakat, Tatweel) entfernen, Schreibvarianten vereinheitlichen.
const HARAKAT = /[ً-ٰٟۖ-ۭـ]/g;

export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFC")
    .replace(HARAKAT, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[‌‍]/g, "") // Null-Breite-Zeichen (ZWNJ) ignorieren
    .replace(/[.,;:!?¡¿"'“”„‚‘’()[\]{}<>/\\|*_~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("de");
}

/** Damerau-Levenshtein (optimal string alignment) über Codepunkte. */
export function editDistance(a: string, b: string): number {
  const A = [...a];
  const B = [...b];
  const d: number[][] = Array.from({ length: A.length + 1 }, () => new Array<number>(B.length + 1).fill(0));
  for (let i = 0; i <= A.length; i++) d[i][0] = i;
  for (let j = 0; j <= B.length; j++) d[0][j] = j;
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      const cost = A[i - 1] === B[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && A[i - 1] === B[j - 2] && A[i - 2] === B[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[A.length][B.length];
}

export type Verdict = "correct" | "typo" | "wrong";

export interface Judgement {
  verdict: Verdict;
  /** Die Lösung, gegen die bewertet wurde (bei Tippfehlern für die Anzeige der Korrektur). */
  expected: string;
  distance: number;
}

/** Splittet Bedeutungsangaben wie "Haus; Gebäude, Heim" in einzelne Antwortmöglichkeiten. */
export function splitAnswers(gloss: string): string[] {
  return gloss
    .split(/[;,]|\s\/\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function allowedErrors(normalized: string): number {
  return Math.floor([...normalized].length / 10);
}

/** Bewertet eine getippte Antwort gegen eine oder mehrere akzeptierte Lösungen. */
export function judgeAnswer(accepted: string[], typed: string): Judgement {
  const input = normalizeAnswer(typed);
  let best: Judgement = { verdict: "wrong", expected: accepted[0] ?? "", distance: Number.POSITIVE_INFINITY };
  if (!input) return best;
  for (const candidate of accepted) {
    const expected = normalizeAnswer(candidate);
    if (!expected) continue;
    const distance = editDistance(expected, input);
    if (distance === 0) return { verdict: "correct", expected: candidate, distance: 0 };
    if (distance <= allowedErrors(expected) && distance < best.distance) {
      best = { verdict: "typo", expected: candidate, distance };
    }
  }
  return best;
}
