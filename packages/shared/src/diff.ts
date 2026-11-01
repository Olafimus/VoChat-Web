/**
 * Wortgenauer Vergleich zweier Texte (LCS über Wörter und Zwischenräume). Für Korrekturen im Chat
 * und für Änderungen an Wörterbucheinträgen: zeigt genau, was entfernt und was hinzugefügt wurde.
 */
export type DiffPart = { type: "same" | "add" | "del"; text: string };

const tokenize = (s: string) => s.match(/\s+|[\p{L}\p{M}\p{N}'’-]+|[^\s\p{L}\p{M}\p{N}]/gu) ?? [];

export function diffWords(before: string, after: string): DiffPart[] {
  const a = tokenize(before);
  const b = tokenize(after);
  // Sehr lange Texte: grob (alles alt → alles neu), damit es nie langsam wird
  if (a.length * b.length > 250_000) return [...(before ? [{ type: "del" as const, text: before }] : []), ...(after ? [{ type: "add" as const, text: after }] : [])];
  const n = a.length;
  const m = b.length;
  const lcs: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out: DiffPart[] = [];
  const push = (type: DiffPart["type"], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) (push("same", a[i]), i++, j++);
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) push("del", a[i++]);
    else push("add", b[j++]);
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("add", b[j++]);
  return out;
}

/** Ändert sich der Text inhaltlich (nicht nur Groß/Klein, Leerzeichen oder Satzzeichen am Ende)? */
export function isSubstantialChange(before: string | null, after: string | null): boolean {
  const norm = (s: string | null) => (s ?? "").toLocaleLowerCase().replace(/[\s.,;:!?]+/g, " ").trim();
  return norm(before) !== norm(after);
}
