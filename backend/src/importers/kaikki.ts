import { KAIKKI_RELATION_FIELDS, LANG_CODES, lemmaKey, normalizeFormTags, RELATION_KINDS } from "@vochat/shared";
import type { Db } from "../db/index.js";
import { addAudio, addCategory, addExample, addInflection, addRelation, addSense, addTranslation, clearSource, recordRun, upsertLexeme } from "./common.js";

const GENDER_TAGS: Record<string, string> = { masculine: "m", feminine: "f", neuter: "n" };
const KNOWN_LANG_CODES = new Set<string>(LANG_CODES);
// Formen-Tags, die keine echten Wortformen sind (Tabellenköpfe, Umschriften o. Ä.).
const SKIP_FORM_TAGS = new Set(["table-tags", "inflection-template", "romanization", "class"]);
const MAX_FORMS = 120;
const MAX_RELATIONS_PER_KIND = 15;
type KaikkiWordRef = { word?: string };

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
  synonyms?: KaikkiWordRef[];
  antonyms?: KaikkiWordRef[];
}
interface KaikkiEntry {
  word: string;
  pos?: string;
  lang_code?: string;
  tags?: string[];
  senses?: KaikkiSense[];
  translations?: { lang_code?: string; word?: string }[];
  forms?: { form?: string; tags?: string[] }[];
  sounds?: { roman?: string; ipa?: string; audio?: string; ogg_url?: string; mp3_url?: string; tags?: string[] }[];
  synonyms?: KaikkiWordRef[];
  antonyms?: KaikkiWordRef[];
  related?: KaikkiWordRef[];
  derived?: KaikkiWordRef[];
  hypernyms?: KaikkiWordRef[];
  hyponyms?: KaikkiWordRef[];
}

/**
 * Wiktextract/kaikki.org-JSONL (eine Zeile = ein Eintrag). Die Datei pro Sprache enthält Lemmata
 * mit englischen Glossen. Übernommen werden Bedeutungen, Beispiele (mit Übersetzung),
 * Übersetzungen, Genus, Themen, gebeugte Formen und – falls vorhanden – eine Umschrift.
 * Limits halten die Datenbank schlank.
 */
export async function importKaikki(
  db: Db,
  opts: { lang: string; glossLang: string; file: string; text: string; maxSenses?: number; maxExamples?: number },
): Promise<number> {
  const source = `kaikki:${opts.lang}`;
  const maxSenses = opts.maxSenses ?? 12;
  const maxExamples = opts.maxExamples ?? 4;
  let rows = 0;

  await db.tx(async (t) => {
    await clearSource(t, source);
    for (const line of opts.text.split("\n")) {
      if (!line.trim()) continue;
      let entry: KaikkiEntry;
      try {
        entry = JSON.parse(line) as KaikkiEntry;
      } catch {
        continue;
      }
      if (!entry.word || (entry.lang_code && entry.lang_code !== opts.lang)) continue;

      const id = await upsertLexeme(t, opts.lang, entry.word, entry.pos ?? "");
      const entryGender = genderFrom(entry.tags);
      if (entryGender) await t.run("UPDATE lexemes SET gender = COALESCE(gender, ?) WHERE id = ?", [entryGender, id]);
      const roman = entry.sounds?.find((s) => s.roman)?.roman;
      if (roman) await t.run("UPDATE lexemes SET romanization = COALESCE(romanization, ?) WHERE id = ?", [roman, id]);
      const ipa = entry.sounds?.find((s) => s.ipa)?.ipa;
      if (ipa) await t.run("UPDATE lexemes SET ipa = COALESCE(ipa, ?) WHERE id = ?", [ipa, id]);
      // Aufnahmen von Wikimedia Commons (meist CC BY-SA); MP3 bevorzugt, weil überall abspielbar.
      for (const s of (entry.sounds ?? []).filter((s) => s.mp3_url || s.ogg_url).slice(0, 3)) {
        await addAudio(t, id, {
          url: (s.mp3_url ?? s.ogg_url)!,
          source,
          license: "Wikimedia Commons (siehe Dateiseite)",
          speaker: s.audio ? commonsSpeaker(s.audio) : null,
          region: s.tags?.find((tag) => /^[A-Z]/.test(tag)) ?? null,
        });
      }

      for (const sense of (entry.senses ?? []).slice(0, maxSenses)) {
        const gloss = sense.glosses?.at(-1);
        if (gloss) await addSense(t, id, opts.glossLang, gloss, source);
        const g = genderFrom(sense.tags);
        if (g) await t.run("UPDATE lexemes SET gender = COALESCE(gender, ?) WHERE id = ?", [g, id]);
        for (const topic of sense.topics ?? []) await addCategory(t, id, topic, source);
        for (const ex of (sense.examples ?? []).slice(0, maxExamples)) {
          if (!ex.text) continue;
          const translation = ex.english ?? ex.translation ?? null;
          await addExample(t, id, ex.text, translation, translation ? opts.glossLang : null, source);
        }
      }
      let position = 0;
      for (const f of (entry.forms ?? []).slice(0, MAX_FORMS)) {
        if (!f.form || f.form === entry.word || (f.tags ?? []).some((tag) => SKIP_FORM_TAGS.has(tag))) continue;
        await addInflection(t, id, opts.lang, f.form, normalizeFormTags(f.tags ?? []), position++, source);
      }
      // Beziehungen stehen am Eintrag und an einzelnen Bedeutungen (Synonyme/Gegenteile).
      const selfKey = lemmaKey(entry.word);
      for (const kind of RELATION_KINDS) {
        const field = KAIKKI_RELATION_FIELDS[kind] as keyof KaikkiEntry & keyof KaikkiSense;
        const refs = [...((entry[field] as KaikkiWordRef[] | undefined) ?? []), ...(entry.senses ?? []).flatMap((s) => (s[field] as KaikkiWordRef[] | undefined) ?? [])];
        const seen = new Set<string>([selfKey]);
        for (const r of refs) {
          const key = r.word ? lemmaKey(r.word) : "";
          if (!key || seen.has(key)) continue;
          seen.add(key);
          await addRelation(t, id, kind, r.word!, source);
          if (seen.size > MAX_RELATIONS_PER_KIND) break;
        }
      }
      for (const tr of entry.translations ?? []) {
        if (tr.lang_code && KNOWN_LANG_CODES.has(tr.lang_code) && tr.word) await addTranslation(t, id, tr.lang_code, tr.word, source);
      }
      rows++;
    }
    await recordRun(t, "kaikki", opts.lang, opts.file, rows);
  });
  return rows;
}

function genderFrom(tags: string[] | undefined): string | null {
  for (const tag of tags ?? []) if (GENDER_TAGS[tag]) return GENDER_TAGS[tag];
  return null;
}

/** Lingua-Libre-Dateien heißen „LL-Q188 (deu)-Sprecher-Wort.wav“: Sprecher daraus lesen. */
export function commonsSpeaker(file: string): string | null {
  const m = /^LL-Q\d+ \([a-z]{3}\)-([^-]+)-/.exec(file);
  return m ? m[1] : null;
}
