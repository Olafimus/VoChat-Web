import { lemmaKey } from "@vochat/shared";
import type { Db } from "../db/index.js";
import { recordRun, upsertLexeme } from "./common.js";

/**
 * Häufigkeitsliste im Format "wort anzahl" pro Zeile (z. B. hermitdave/FrequencyWords).
 * Rang = Zeilennummer. Lexeme mit gleichem Wortschlüssel bekommen den Rang; fehlende
 * werden mit leerer Wortart angelegt.
 */
export async function importFrequency(db: Db, lang: string, text: string, file: string, limit = 50000): Promise<number> {
  let rows = 0;
  await db.tx(async (t) => {
    let rank = 0;
    for (const line of text.split("\n")) {
      const [word, countStr] = line.trim().split(/\s+/);
      if (!word || !countStr) continue;
      rank++;
      if (rank > limit) break;
      const count = Number(countStr);
      const value = Number.isFinite(count) ? count : null;
      const result = await t.run("UPDATE lexemes SET frequency_rank = ?, frequency_count = ? WHERE lang = ? AND lemma_key = ?", [
        rank,
        value,
        lang,
        lemmaKey(word),
      ]);
      if (result.changes === 0) {
        const id = await upsertLexeme(t, lang, word, "");
        await t.run("UPDATE lexemes SET frequency_rank = ?, frequency_count = ? WHERE id = ?", [rank, value, id]);
      }
      rows++;
    }
    await recordRun(t, "frequency", lang, file, rows);
  });
  return rows;
}
