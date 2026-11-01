import { LANG_CODES, lemmaKey, type LangCode } from "@vochat/shared";
import type { Db } from "../db/index.js";

export const isKnownLang = (value: string): value is LangCode => (LANG_CODES as string[]).includes(value);

/** Alle Zeilen einer Quelle vorher entfernen, damit ein erneuter Import idempotent ist. */
export async function clearSource(db: Db, source: string): Promise<void> {
  await db.run("DELETE FROM senses WHERE source = ?", [source]);
  await db.run("DELETE FROM examples WHERE source = ?", [source]);
  await db.run("DELETE FROM translations WHERE source = ?", [source]);
  await db.run("DELETE FROM lexeme_audio WHERE source = ?", [source]);
  await db.run("DELETE FROM lexeme_categories WHERE category_id IN (SELECT id FROM categories WHERE kind = ?)", [source]);
}

/**
 * Liefert die Lexem-ID für (Sprache, Lemma, Wortart). Gibt es noch kein Lexem mit dieser
 * Wortart, übernimmt ein Lexem ohne Wortart mit gleichem Wortschlüssel (z. B. aus der
 * Häufigkeitsliste) den Eintrag – so entstehen keine Duplikate wie "haus" neben "Haus".
 */
export async function upsertLexeme(db: Db, lang: string, lemma: string, pos: string): Promise<number> {
  return (await upsertLexemeInfo(db, lang, lemma, pos)).id;
}

/** Wie upsertLexeme, meldet zusätzlich, ob das Lexem neu angelegt wurde. */
export async function upsertLexemeInfo(db: Db, lang: string, lemma: string, pos: string): Promise<{ id: number; created: boolean }> {
  const exact = await db.get<{ id: number }>("SELECT id FROM lexemes WHERE lang = ? AND lemma = ? AND pos = ?", [lang, lemma, pos]);
  if (exact) return { id: Number(exact.id), created: false };
  const key = lemmaKey(lemma);

  if (pos !== "") {
    const bare = await db.get<{ id: number }>("SELECT id FROM lexemes WHERE lang = ? AND pos = '' AND lemma_key = ? ORDER BY id LIMIT 1", [
      lang,
      key,
    ]);
    if (bare) {
      await db.run("UPDATE lexemes SET lemma = ?, pos = ? WHERE id = ?", [lemma, pos, bare.id]);
      return { id: Number(bare.id), created: false };
    }
  }

  const inserted = await db.get<{ id: number }>("INSERT INTO lexemes (lang, lemma, lemma_key, pos) VALUES (?, ?, ?, ?) RETURNING id", [
    lang,
    lemma,
    key,
    pos,
  ]);
  return { id: Number(inserted!.id), created: true };
}

export async function addForm(db: Db, lexemeId: number, lang: string, form: string): Promise<void> {
  const key = lemmaKey(form);
  if (!key) return;
  await db.run("INSERT INTO lexeme_forms (lexeme_id, lang, form_key) VALUES (?, ?, ?) ON CONFLICT DO NOTHING", [lexemeId, lang, key]);
}

export async function addSense(db: Db, lexemeId: number, glossLang: string, gloss: string, source: string): Promise<void> {
  const text = gloss.replace(/\s+/g, " ").trim();
  if (!text) return;
  const row = await db.get<{ p: number }>("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM senses WHERE lexeme_id = ? AND gloss_lang = ?", [
    lexemeId,
    glossLang,
  ]);
  await db.run("INSERT INTO senses (lexeme_id, position, gloss_lang, gloss, source) VALUES (?, ?, ?, ?, ?)", [
    lexemeId,
    Number(row?.p ?? 0),
    glossLang,
    text,
    source,
  ]);
}

export async function addExample(
  db: Db,
  lexemeId: number,
  text: string,
  translation: string | null,
  translationLang: string | null,
  source: string,
): Promise<void> {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return;
  await db.run("INSERT INTO examples (lexeme_id, text, translation, translation_lang, source) VALUES (?, ?, ?, ?, ?)", [
    lexemeId,
    t,
    translation?.trim() || null,
    translationLang,
    source,
  ]);
}

export async function addTranslation(db: Db, lexemeId: number, targetLang: string, targetLemma: string, source: string): Promise<void> {
  const lemma = targetLemma.trim();
  if (!lemma || !isKnownLang(targetLang)) return;
  await db.run(
    `INSERT INTO translations (lexeme_id, target_lang, target_lemma, source) VALUES (?, ?, ?, ?)
     ON CONFLICT (lexeme_id, target_lang, target_lemma) DO NOTHING`,
    [lexemeId, targetLang, lemma, source],
  );
}

export async function addCategory(db: Db, lexemeId: number, name: string, kind: string): Promise<void> {
  await db.run("INSERT INTO categories (name, kind) VALUES (?, ?) ON CONFLICT (name, kind) DO NOTHING", [name, kind]);
  const cat = await db.get<{ id: number }>("SELECT id FROM categories WHERE name = ? AND kind = ?", [name, kind]);
  await db.run("INSERT INTO lexeme_categories (lexeme_id, category_id) VALUES (?, ?) ON CONFLICT DO NOTHING", [lexemeId, cat!.id]);
}

export async function recordRun(db: Db, source: string, lang: string | null, file: string, rows: number): Promise<void> {
  await db.run("INSERT INTO import_runs (source, lang, file, rows, imported_at) VALUES (?, ?, ?, ?, ?)", [source, lang, file, rows, Date.now()]);
}

/** Minimaler CSV-Parser (RFC 4180, mit Anführungszeichen). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  return rows;
}

/** Verweis auf eine Aussprache-Aufnahme (nur URL + Lizenz, keine Datei). */
export async function addAudio(
  db: Db,
  lexemeId: number,
  a: { url: string; source: string; license?: string | null; speaker?: string | null; region?: string | null },
): Promise<void> {
  if (!/^https:\/\//.test(a.url)) return;
  await db.run(
    `INSERT INTO lexeme_audio (lexeme_id, url, source, license, speaker, region, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (lexeme_id, url) DO NOTHING`,
    [lexemeId, a.url, a.source, a.license ?? null, a.speaker ?? null, a.region ?? null, Date.now()],
  );
}
