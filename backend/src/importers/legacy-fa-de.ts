import { transaction, type Db } from "../db.js";
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
 * Bestehende Farsi→Deutsch-Vokabelliste (FarsInGermanDictionary, Export der alten App).
 * Lemma = vocab[0], Aussprache = pronunciation[0], Bedeutungen = translation[],
 * Redewendungen aus hints (als Beispiele mit deutscher Übersetzung).
 */
export function importLegacyFaDe(db: Db, file: string, json: string): number {
  const items = JSON.parse(json) as LegacyItem[];
  const source = "legacy:fa-de";
  let rows = 0;
  transaction(db, () => {
    clearSource(db, source);
    for (const item of items) {
      const lemma = item.vocab?.[0]?.trim();
      if (!lemma || item.vocLanguage !== "Farsi") continue;
      const id = upsertLexeme(db, "fa", lemma, "");
      if (item.pronunciation?.[0]) {
        db.prepare("UPDATE lexemes SET romanization = COALESCE(romanization, ?) WHERE id = ?").run(item.pronunciation[0], id);
      }
      for (const gloss of item.translation ?? []) {
        const de = cleanGerman(gloss);
        addSense(db, id, "de", de, source);
        addTranslation(db, id, "de", de, source);
      }
      for (const hint of item.hints ?? []) {
        const phrase = cleanPersianPhrase(hint.voc ?? "");
        const de = cleanGerman(hint.trans?.[0] ?? "");
        if (phrase) addExample(db, id, phrase, de || null, de ? "de" : null, source);
      }
      rows++;
    }
    recordRun(db, "legacy", "fa", file, rows);
  });
  return rows;
}
