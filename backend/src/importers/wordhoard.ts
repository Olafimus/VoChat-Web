import type { Db } from "../db/index.js";
import { addForm, parseCsv, recordRun, upsertLexeme } from "./common.js";

const POS_ALIASES: Record<string, string> = {
  DET: "determiner",
  ADP: "preposition",
  SCONJ: "conjunction",
  CCONJ: "conjunction",
  PRON: "pronoun",
  ADV: "adverb",
  ADJ: "adjective",
  NOUN: "noun",
  PROPN: "proper noun",
  VERB: "verb",
  AUX: "auxiliary",
  NUM: "numeral",
  INTJ: "interjection",
  PART: "particle",
};
const GENDER: Record<string, string> = { der: "m", die: "f", das: "n", m: "m", f: "f", n: "n" };

/**
 * wordhoard-CSV (lemma,pos,gender,frequency_rank,frequency_count,cefr_estimate,notes,forms).
 * Liefert Häufigkeit, Wortart, Genus, CEFR-Schätzung und gebeugte Formen ("ist:pres.3sg;war:surface").
 */
export async function importWordhoard(db: Db, lang: string, csv: string, file: string): Promise<number> {
  const [header, ...body] = parseCsv(csv);
  const col = (name: string) => header.indexOf(name);
  const idx = {
    lemma: col("lemma"),
    pos: col("pos"),
    gender: col("gender"),
    rank: col("frequency_rank"),
    count: col("frequency_count"),
    cefr: col("cefr_estimate"),
    forms: col("forms"),
  };
  if (idx.lemma < 0) throw new Error("wordhoard CSV: Spalte 'lemma' fehlt");

  let rows = 0;
  await db.tx(async (t) => {
    for (const r of body) {
      const lemma = r[idx.lemma]?.trim();
      if (!lemma) continue;
      const rawPos = (r[idx.pos] ?? "").trim();
      const pos = POS_ALIASES[rawPos] ?? rawPos.toLowerCase();
      const gender = GENDER[(r[idx.gender] ?? "").trim().toLowerCase()] ?? null;
      const cefr = (r[idx.cefr] ?? "").trim() || null;
      const rank = Number(r[idx.rank]) || null;
      const count = Number(r[idx.count]) || null;
      const id = await upsertLexeme(t, lang, lemma, pos);
      await t.run(
        "UPDATE lexemes SET gender = COALESCE(?, gender), cefr = COALESCE(?, cefr), frequency_rank = ?, frequency_count = ? WHERE id = ?",
        [gender, cefr, rank, count, id],
      );
      if (idx.forms >= 0) {
        for (const part of (r[idx.forms] ?? "").split(";")) {
          const form = part.split(":")[0]?.trim();
          if (form) await addForm(t, id, lang, form);
        }
      }
      rows++;
    }
    await recordRun(t, "wordhoard", lang, file, rows);
  });
  return rows;
}
