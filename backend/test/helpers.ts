import { lemmaKey } from "@vochat/shared";
import { openDatabase, type Db } from "../src/db/index.js";

/** Testdatenbank: SQLite im Speicher, oder Postgres (PGlite) mit TEST_DB=postgres. */
export function testDb(): Promise<Db> {
  return openDatabase(process.env.TEST_DB === "postgres" ? "pglite:" : ":memory:");
}

/** Legt ein Lexem an (mit Wortschlüssel). Feste IDs sind erlaubt; unter Postgres wird die Sequenz nachgezogen. */
export async function addLexeme(
  db: Db,
  l: { id?: number; lang: string; lemma: string; pos?: string; rank?: number | null; cefr?: string | null; romanization?: string | null },
): Promise<number> {
  const row = await db.get<{ id: number }>(
    l.id === undefined
      ? "INSERT INTO lexemes (lang, lemma, lemma_key, pos, frequency_rank, cefr, romanization) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id"
      : "INSERT INTO lexemes (id, lang, lemma, lemma_key, pos, frequency_rank, cefr, romanization) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
    [
      ...(l.id === undefined ? [] : [l.id]),
      l.lang,
      l.lemma,
      lemmaKey(l.lemma),
      l.pos ?? "",
      l.rank ?? null,
      l.cefr ?? null,
      l.romanization ?? null,
    ],
  );
  if (l.id !== undefined && db.dialect === "postgres") {
    await db.exec("SELECT setval(pg_get_serial_sequence('lexemes', 'id'), (SELECT MAX(id) FROM lexemes))");
  }
  return Number(row!.id);
}

export async function addGloss(db: Db, lexemeId: number, glossLang: string, gloss: string, position = 0): Promise<void> {
  await db.run("INSERT INTO senses (lexeme_id, position, gloss_lang, gloss, source) VALUES (?, ?, ?, ?, 'test')", [lexemeId, position, glossLang, gloss]);
}
