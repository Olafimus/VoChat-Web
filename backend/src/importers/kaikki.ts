import { transaction, type Db } from "../db.js";
import { LANG_CODES } from "@vochat/shared";
import { addExample, addCategory, addSense, addTranslation, clearSource, recordRun, upsertLexeme } from "./common.js";

const GENDER_TAGS: Record<string, string> = { masculine: "m", feminine: "f", neuter: "n" };
const KNOWN_LANG_CODES = new Set<string>(LANG_CODES);

interface KaikkiExample {
  text?: string;
  translation?: string;
  english?: string;
}
interface KaikkiSense {
  glosses?: string[];
  tags?: string[];
  topics?: string[];
  examples?: KaikkiExample[];
}
interface KaikkiEntry {
  word: string;
  pos?: string;
  lang_code?: string;
  tags?: string[];
  senses?: KaikkiSense[];
  translations?: { lang_code?: string; word?: string }[];
}

/**
 * Wiktextract/kaikki.org-JSONL (eine Zeile = ein Wörterbucheintrag). Die Datei
 * pro Sprache (z. B. "German") enthält Lemmata der Sprache mit englischen
 * Glossen. Bedeutungen, Beispiele (mit Übersetzung), Übersetzungen, Genus und
 * Themen werden übernommen. Limits halten die Datenbank schlank.
 */
export function importKaikki(
  db: Db,
  opts: { lang: string; glossLang: string; file: string; text: string; maxSenses?: number; maxExamples?: number },
): number {
  const source = `kaikki:${opts.lang}`;
  const maxSenses = opts.maxSenses ?? 12;
  const maxExamples = opts.maxExamples ?? 4;
  let rows = 0;

  transaction(db, () => {
    clearSource(db, source);
    for (const line of opts.text.split("\n")) {
      if (!line.trim()) continue;
      let entry: KaikkiEntry;
      try {
        entry = JSON.parse(line) as KaikkiEntry;
      } catch {
        continue;
      }
      if (!entry.word || (entry.lang_code && entry.lang_code !== opts.lang)) continue;

      const pos = entry.pos ?? "";
      const id = upsertLexeme(db, opts.lang, entry.word, pos);
      const entryGender = genderFrom(entry.tags);
      if (entryGender) db.prepare("UPDATE lexemes SET gender = COALESCE(gender, ?) WHERE id = ?").run(entryGender, id);

      for (const sense of (entry.senses ?? []).slice(0, maxSenses)) {
        const gloss = sense.glosses?.at(-1);
        if (gloss) addSense(db, id, opts.glossLang, gloss, source);
        const g = genderFrom(sense.tags);
        if (g) db.prepare("UPDATE lexemes SET gender = COALESCE(gender, ?) WHERE id = ?").run(g, id);
        for (const topic of sense.topics ?? []) addCategory(db, id, topic, source);
        for (const ex of (sense.examples ?? []).slice(0, maxExamples)) {
          if (!ex.text) continue;
          const translation = ex.english ?? ex.translation ?? null;
          addExample(db, id, ex.text, translation, translation ? opts.glossLang : null, source);
        }
      }

      for (const t of entry.translations ?? []) {
        if (t.lang_code && KNOWN_LANG_CODES.has(t.lang_code) && t.word) {
          addTranslation(db, id, t.lang_code, t.word, source);
        }
      }
      rows++;
    }
    recordRun(db, "kaikki", opts.lang, opts.file, rows);
  });
  return rows;
}

function genderFrom(tags: string[] | undefined): string | null {
  for (const tag of tags ?? []) if (GENDER_TAGS[tag]) return GENDER_TAGS[tag];
  return null;
}
