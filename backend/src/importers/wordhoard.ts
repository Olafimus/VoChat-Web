import { transaction, type Db } from "../db.js";
import { parseCsv, recordRun, upsertLexeme } from "./common.js";

const POS_ALIASES: Record<string, string> = { DET: "determiner", ADP: "preposition", SCONJ: "conjunction", CCONJ: "conjunction", PRON: "pronoun", ADV: "adverb", ADJ: "adjective", NOUN: "noun", PROPN: "proper noun", VERB: "verb", AUX: "auxiliary", NUM: "numeral", INTJ: "interjection", PART: "particle" };
const GENDER: Record<string, string> = { der: "m", die: "f", das: "n", m: "m", f: "f", n: "n" };

/**
 * wordhoard-CSV (lemma,pos,gender,frequency_rank,frequency_count,cefr_estimate,notes,forms).
 * Liefert Häufigkeit, Wortart, Genus und CEFR-Schätzung (Top-N pro Sprache).
 */
export function importWordhoard(db: Db, lang: string, csv: string, file: string): number {
  const [header, ...body] = parseCsv(csv);
  const col = (name: string) => header.indexOf(name);
  const idx = {
    lemma: col("lemma"),
    pos: col("pos"),
    gender: col("gender"),
    rank: col("frequency_rank"),
    count: col("frequency_count"),
    cefr: col("cefr_estimate"),
  };
  if (idx.lemma < 0) throw new Error("wordhoard CSV: Spalte 'lemma' fehlt");

  let rows = 0;
  transaction(db, () => {
    const update = db.prepare(
      "UPDATE lexemes SET gender = COALESCE(?, gender), cefr = COALESCE(?, cefr), frequency_rank = ?, frequency_count = ? WHERE id = ?",
    );
    for (const r of body) {
      const lemma = r[idx.lemma]?.trim();
      if (!lemma) continue;
      const rawPos = (r[idx.pos] ?? "").trim();
      const pos = POS_ALIASES[rawPos] ?? rawPos.toLowerCase();
      const gender = GENDER[(r[idx.gender] ?? "").trim().toLowerCase()] ?? null;
      const cefr = (r[idx.cefr] ?? "").trim() || null;
      const rank = Number(r[idx.rank]) || null;
      const count = Number(r[idx.count]) || null;
      const id = upsertLexeme(db, lang, lemma, pos);
      update.run(gender, cefr, rank, count, id);
      rows++;
    }
    recordRun(db, "wordhoard", lang, file, rows);
  });
  return rows;
}
