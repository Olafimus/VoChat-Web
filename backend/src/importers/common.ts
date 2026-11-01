import { LANG_CODES, type LangCode } from "@vochat/shared";
import { transaction, type Db } from "../db.js";

export const isKnownLang = (value: string): value is LangCode => (LANG_CODES as string[]).includes(value);

/** Alle Zeilen einer Quelle vorher entfernen, damit ein erneuter Import idempotent ist. */
export function clearSource(db: Db, source: string): void {
  db.prepare("DELETE FROM senses WHERE source = ?").run(source);
  db.prepare("DELETE FROM examples WHERE source = ?").run(source);
  db.prepare("DELETE FROM translations WHERE source = ?").run(source);
  db.prepare(
    "DELETE FROM lexeme_categories WHERE category_id IN (SELECT id FROM categories WHERE kind = ?)",
  ).run(source);
}

/**
 * Liefert die Lexem-ID für (Sprache, Lemma, Wortart). Gibt es noch kein Lexem mit
 * dieser Wortart, übernimmt ein Lexem ohne Wortart (z. B. aus der Häufigkeitsliste)
 * den Eintrag – so entstehen keine Duplikate wie "haus" neben "Haus".
 */
export function upsertLexeme(db: Db, lang: string, lemma: string, pos: string): number {
  const exact = db.prepare("SELECT id FROM lexemes WHERE lang = ? AND lemma = ? AND pos = ?").get(lang, lemma, pos) as
    | { id: number }
    | undefined;
  if (exact) return exact.id;

  if (pos !== "") {
    const bare = db
      .prepare("SELECT id FROM lexemes WHERE lang = ? AND pos = '' AND lemma COLLATE NOCASE = ? ORDER BY id LIMIT 1")
      .get(lang, lemma) as { id: number } | undefined;
    if (bare) {
      db.prepare("UPDATE lexemes SET lemma = ?, pos = ? WHERE id = ?").run(lemma, pos, bare.id);
      return bare.id;
    }
  }

  const inserted = db.prepare("INSERT INTO lexemes (lang, lemma, pos) VALUES (?, ?, ?)").run(lang, lemma, pos);
  return Number(inserted.lastInsertRowid);
}

export function nextSensePosition(db: Db, lexemeId: number, glossLang: string): number {
  const row = db
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM senses WHERE lexeme_id = ? AND gloss_lang = ?")
    .get(lexemeId, glossLang) as { p: number };
  return row.p;
}

export function addSense(db: Db, lexemeId: number, glossLang: string, gloss: string, source: string): void {
  const text = gloss.replace(/\s+/g, " ").trim();
  if (!text) return;
  const position = nextSensePosition(db, lexemeId, glossLang);
  db.prepare("INSERT INTO senses (lexeme_id, position, gloss_lang, gloss, source) VALUES (?, ?, ?, ?, ?)").run(
    lexemeId,
    position,
    glossLang,
    text,
    source,
  );
}

export function addExample(
  db: Db,
  lexemeId: number,
  text: string,
  translation: string | null,
  translationLang: string | null,
  source: string,
): void {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return;
  db.prepare(
    "INSERT INTO examples (lexeme_id, text, translation, translation_lang, source) VALUES (?, ?, ?, ?, ?)",
  ).run(lexemeId, t, translation?.trim() || null, translationLang, source);
}

export function addTranslation(db: Db, lexemeId: number, targetLang: string, targetLemma: string, source: string): void {
  const lemma = targetLemma.trim();
  if (!lemma || !isKnownLang(targetLang)) return;
  db.prepare(
    `INSERT INTO translations (lexeme_id, target_lang, target_lemma, source) VALUES (?, ?, ?, ?)
     ON CONFLICT (lexeme_id, target_lang, target_lemma) DO NOTHING`,
  ).run(lexemeId, targetLang, lemma, source);
}

export function addCategory(db: Db, lexemeId: number, name: string, kind: string): void {
  db.prepare("INSERT INTO categories (name, kind) VALUES (?, ?) ON CONFLICT (name, kind) DO NOTHING").run(name, kind);
  const cat = db.prepare("SELECT id FROM categories WHERE name = ? AND kind = ?").get(name, kind) as { id: number };
  db.prepare("INSERT INTO lexeme_categories (lexeme_id, category_id) VALUES (?, ?) ON CONFLICT DO NOTHING").run(
    lexemeId,
    cat.id,
  );
}

export function recordRun(db: Db, source: string, lang: string | null, file: string, rows: number): void {
  db.prepare("INSERT INTO import_runs (source, lang, file, rows, imported_at) VALUES (?, ?, ?, ?, ?)").run(
    source,
    lang,
    file,
    rows,
    Date.now(),
  );
}

export function inTransaction<T>(db: Db, fn: () => T): T {
  return transaction(db, fn);
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
