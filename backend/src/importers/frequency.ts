import { transaction, type Db } from "../db.js";
import { recordRun, upsertLexeme } from "./common.js";

/**
 * Häufigkeitsliste im Format "wort anzahl" pro Zeile (z. B. hermitdave/FrequencyWords,
 * OpenSubtitles). Rang = Zeilennummer. Bestehende Lexeme (Groß-/Kleinschreibung egal)
 * bekommen den Rang; fehlende werden mit leerer Wortart angelegt.
 */
export function importFrequency(db: Db, lang: string, text: string, file: string, limit = 50000): number {
  const update = db.prepare(
    "UPDATE lexemes SET frequency_rank = ?, frequency_count = ? WHERE lang = ? AND lemma COLLATE NOCASE = ?",
  );
  let rows = 0;
  transaction(db, () => {
    let rank = 0;
    for (const line of text.split("\n")) {
      const [word, countStr] = line.trim().split(/\s+/);
      if (!word || !countStr) continue;
      rank++;
      if (rank > limit) break;
      const count = Number(countStr);
      const result = update.run(rank, Number.isFinite(count) ? count : null, lang, word);
      if (Number(result.changes) === 0) {
        const id = upsertLexeme(db, lang, word, "");
        db.prepare("UPDATE lexemes SET frequency_rank = ?, frequency_count = ? WHERE id = ?").run(
          rank,
          Number.isFinite(count) ? count : null,
          id,
        );
      }
      rows++;
    }
    recordRun(db, "frequency", lang, file, rows);
  });
  return rows;
}
