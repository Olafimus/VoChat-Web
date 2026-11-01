import type { Db } from "../db/index.js";
import { addExample, addSense, addTranslation, clearSource, recordRun, upsertLexeme } from "./common.js";

interface LegacyItem {
  vocab?: string[];
  vocLanguage?: string;
  transLanguage?: string;
  translation?: string[];
  pronunciation?: string[];
  hints?: { voc?: string; trans?: string[] }[];
}

const PERSIAN_TAIL = /[؀-ۿ].*$/u;
const cleanGerman = (s: string) => s.replace(PERSIAN_TAIL, "").replace(/\s+/g, " ").trim();
const cleanPersianPhrase = (s: string) => s.replace(/\s*\[[^\]]*\]\s*$/, "").trim();

/**
 * Bestehende Farsi→Deutsch-Vokabelliste (Export der alten App).
 * Lemma = vocab[0], Aussprache = pronunciation[0], Bedeutungen = translation[],
 * Redewendungen aus hints (als Beispiele mit deutscher Übersetzung).
 */
export async function importLegacyFaDe(db: Db, file: string, json: string): Promise<number> {
  const items = JSON.parse(json) as LegacyItem[];
  const source = "legacy:fa-de";
  let rows = 0;
  await db.tx(async (t) => {
    await clearSource(t, source);
    for (const item of items) {
      const lemma = item.vocab?.[0]?.trim();
      if (!lemma || item.vocLanguage !== "Farsi") continue;
      const id = await upsertLexeme(t, "fa", lemma, "");
      if (item.pronunciation?.[0]) {
        await t.run("UPDATE lexemes SET romanization = COALESCE(romanization, ?) WHERE id = ?", [item.pronunciation[0], id]);
      }
      for (const gloss of item.translation ?? []) {
        const de = cleanGerman(gloss);
        await addSense(t, id, "de", de, source);
        await addTranslation(t, id, "de", de, source);
      }
      for (const hint of item.hints ?? []) {
        const phrase = cleanPersianPhrase(hint.voc ?? "");
        const de = cleanGerman(hint.trans?.[0] ?? "");
        if (phrase) await addExample(t, id, phrase, de || null, de ? "de" : null, source);
      }
      rows++;
    }
    await recordRun(t, "legacy", "fa", file, rows);
  });
  return rows;
}
