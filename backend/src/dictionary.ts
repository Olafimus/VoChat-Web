import { lemmaKey, tokenize, type AudioRecording, type Cefr, type ExtractResult, type LangCode, type LexemeDetail, type LexemeSummary } from "@vochat/shared";
import type { Db, Param } from "./db/index.js";

type SummaryRow = {
  id: number;
  lang: string;
  lemma: string;
  pos: string;
  gender: string | null;
  cefr: string | null;
  frequency_rank: number | null;
  romanization: string | null;
  gloss: string | null;
  translation: string | null;
  /** Rückfall, wenn es keine Bedeutung in der Muttersprache gibt (die meisten Quellen glossieren englisch). */
  gloss_en?: string | null;
};

/** Zusammenfassung eines Lexems; die beiden ersten Parameter sind jeweils die Muttersprache. */
const SUMMARY_SELECT = `
  SELECT l.id, l.lang, l.lemma, l.pos, l.gender, l.cefr, l.frequency_rank, l.romanization,
    (SELECT s.gloss FROM senses s WHERE s.lexeme_id = l.id AND s.hidden = 0 AND s.gloss_lang = ?
      ORDER BY s.position LIMIT 1) AS gloss,
    (SELECT t.target_lemma FROM translations t WHERE t.lexeme_id = l.id AND t.hidden = 0 AND t.target_lang = ?
      ORDER BY t.id LIMIT 1) AS translation,
    (SELECT s.gloss FROM senses s WHERE s.lexeme_id = l.id AND s.hidden = 0 AND s.gloss_lang = 'en'
      ORDER BY s.position LIMIT 1) AS gloss_en
  FROM lexemes l`;

function toSummary(row: SummaryRow): LexemeSummary {
  return {
    id: Number(row.id),
    lang: row.lang as LangCode,
    lemma: row.lemma,
    pos: row.pos || null,
    gender: row.gender,
    cefr: row.cefr,
    frequencyRank: row.frequency_rank === null ? null : Number(row.frequency_rank),
    romanization: row.romanization,
    gloss: row.gloss ?? row.translation ?? (row.gloss_en ? `(en) ${row.gloss_en}` : null),
  };
}

const marks = (n: number) => Array.from({ length: n }, () => "?").join(", ");

/** Präfix-Suche über den normalisierten Wortschlüssel: exakte Treffer zuerst, dann nach Häufigkeit. */
export async function searchLexemes(
  db: Db,
  opts: { lang: LangCode; q: string; nativeLang: LangCode; limit: number },
): Promise<LexemeSummary[]> {
  const key = lemmaKey(opts.q);
  if (!key) return [];
  const rows = await db.all<SummaryRow>(
    `${SUMMARY_SELECT}
     WHERE l.lang = ? AND l.hidden = 0 AND l.lemma_key >= ? AND l.lemma_key < ?
     ORDER BY (l.lemma_key = ?) DESC, l.frequency_rank IS NULL, l.frequency_rank, l.lemma
     LIMIT ?`,
    [opts.nativeLang, opts.nativeLang, opts.lang, key, key + "￿", key, opts.limit],
  );
  return rows.map(toSummary);
}

/** Durchstöbern nach Sprache, optionalem CEFR-Niveau und Häufigkeit. */
export async function browseLexemes(
  db: Db,
  opts: { lang: LangCode; nativeLang: LangCode; cefr?: Cefr; limit: number; offset: number },
): Promise<LexemeSummary[]> {
  const where = ["l.lang = ?", "l.hidden = 0"];
  const params: Param[] = [opts.nativeLang, opts.nativeLang, opts.lang];
  if (opts.cefr) {
    where.push("l.cefr = ?");
    params.push(opts.cefr);
  }
  params.push(opts.limit, opts.offset);
  const rows = await db.all<SummaryRow>(
    `${SUMMARY_SELECT} WHERE ${where.join(" AND ")}
     ORDER BY l.frequency_rank IS NULL, l.frequency_rank, l.lemma LIMIT ? OFFSET ?`,
    params,
  );
  return rows.map(toSummary);
}

/** Mehrere Lexeme auf einmal (z. B. um verknüpfte Karten zu aktualisieren). */
export async function lexemesByIds(db: Db, ids: number[], nativeLang: LangCode): Promise<LexemeSummary[]> {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 500);
  if (unique.length === 0) return [];
  const rows = await db.all<SummaryRow>(`${SUMMARY_SELECT} WHERE l.hidden = 0 AND l.id IN (${marks(unique.length)})`, [
    nativeLang,
    nativeLang,
    ...unique,
  ]);
  return rows.map(toSummary);
}

/**
 * Wörter zu Lexemen auflösen: zuerst über den Wortschlüssel des Lemmas, sonst über eine
 * bekannte gebeugte Form. Bei mehreren Treffern gewinnt der häufigste (mit Wortart vor ohne).
 * Ergebnis: Schlüssel -> Lexem.
 */
export async function resolveWords(
  db: Db,
  lang: LangCode,
  words: string[],
  nativeLang: LangCode,
): Promise<Map<string, LexemeSummary>> {
  const keys = [...new Set(words.map(lemmaKey).filter(Boolean))].slice(0, 500);
  const result = new Map<string, LexemeSummary>();
  if (keys.length === 0) return result;

  const order = "ORDER BY l.frequency_rank IS NULL, l.frequency_rank, (l.pos = '') , l.id";
  const direct = await db.all<SummaryRow & { k: string }>(
    `${SUMMARY_SELECT.replace("SELECT l.id", "SELECT l.lemma_key AS k, l.id")}
     WHERE l.lang = ? AND l.hidden = 0 AND l.lemma_key IN (${marks(keys.length)}) ${order}`,
    [nativeLang, nativeLang, lang, ...keys],
  );
  for (const row of direct) if (!result.has(row.k)) result.set(row.k, toSummary(row));

  const missing = keys.filter((k) => !result.has(k));
  if (missing.length > 0) {
    const viaForm = await db.all<SummaryRow & { k: string }>(
      `${SUMMARY_SELECT.replace("SELECT l.id", "SELECT f.form_key AS k, l.id").replace(
        "FROM lexemes l",
        "FROM lexeme_forms f JOIN lexemes l ON l.id = f.lexeme_id",
      )}
       WHERE f.lang = ? AND l.hidden = 0 AND f.form_key IN (${marks(missing.length)}) ${order}`,
      [nativeLang, nativeLang, lang, ...missing],
    );
    for (const row of viaForm) if (!result.has(row.k)) result.set(row.k, toSummary(row));
  }
  return result;
}

/**
 * Wörter aus einem Text extrahieren. Gefundene Wörter werden zu Lexemen aufgelöst (auch
 * gebeugte Formen, soweit bekannt); der Text selbst wird nicht gespeichert.
 */
export async function extractWords(db: Db, lang: LangCode, text: string, nativeLang: LangCode, limit = 400): Promise<ExtractResult> {
  const tokens = tokenize(text, limit);
  const resolved = await resolveWords(db, lang, tokens, nativeLang);
  const matches: LexemeSummary[] = [];
  const seen = new Set<number>();
  const unknown: string[] = [];
  const forms: Record<number, string[]> = {};
  for (const token of tokens) {
    const key = lemmaKey(token);
    const hit = resolved.get(key);
    if (!hit) {
      unknown.push(token);
      continue;
    }
    if (!seen.has(hit.id)) {
      seen.add(hit.id);
      matches.push(hit);
    }
    if (key !== lemmaKey(hit.lemma)) (forms[hit.id] ??= []).push(token);
  }
  return { matches, unknown, forms };
}

export async function lexemeDetail(db: Db, id: number, nativeLang: LangCode): Promise<LexemeDetail | null> {
  const row = await db.get<SummaryRow>(`${SUMMARY_SELECT} WHERE l.id = ? AND l.hidden = 0`, [nativeLang, nativeLang, id]);
  if (!row) return null;

  const [senses, examples, translations, categories, audio, ipaRow] = await Promise.all([
    db.all<{ position: number; gloss_lang: string; gloss: string; source: string }>(
      "SELECT position, gloss_lang, gloss, source FROM senses WHERE lexeme_id = ? AND hidden = 0 ORDER BY (gloss_lang = ?) DESC, position LIMIT 40",
      [id, nativeLang],
    ),
    db.all<{ text: string; translation: string | null; translation_lang: string | null; source: string }>(
      "SELECT text, translation, translation_lang, source FROM examples WHERE lexeme_id = ? AND hidden = 0 ORDER BY id LIMIT 30",
      [id],
    ),
    db.all<{ target_lang: string; target_lemma: string; source: string }>(
      "SELECT target_lang, target_lemma, source FROM translations WHERE lexeme_id = ? AND hidden = 0 ORDER BY (target_lang = ?) DESC, id LIMIT 60",
      [id, nativeLang],
    ),
    db.all<{ name: string; kind: string }>(
      `SELECT c.name, c.kind FROM lexeme_categories lc JOIN categories c ON c.id = lc.category_id
       WHERE lc.lexeme_id = ? ORDER BY c.kind, c.name`,
      [id],
    ),
    lexemeAudio(db, id),
    db.get<{ ipa: string | null }>("SELECT ipa FROM lexemes WHERE id = ?", [id]),
  ]);

  return {
    ...toSummary(row),
    senses: senses.map((s) => ({ position: Number(s.position), glossLang: s.gloss_lang, gloss: s.gloss, source: s.source })),
    examples: examples.map((e) => ({ text: e.text, translation: e.translation, translationLang: e.translation_lang, source: e.source })),
    translations: translations.map((t) => ({ targetLang: t.target_lang as LangCode, targetLemma: t.target_lemma, source: t.source })),
    categories,
    ipa: ipaRow?.ipa ?? null,
    audio,
  };
}

export async function lexemeAudio(db: Db, id: number): Promise<AudioRecording[]> {
  const rows = await db.all<{ url: string; license: string | null; speaker: string | null; region: string | null; source: string }>(
    "SELECT url, license, speaker, region, source FROM lexeme_audio WHERE lexeme_id = ? AND status = 'approved' ORDER BY CASE WHEN user_id IS NULL THEN 0 ELSE 1 END, id LIMIT 5",
    [id],
  );
  return rows.map((r) => ({ url: r.url, license: r.license, speaker: r.speaker, region: r.region, source: r.source }));
}

export async function languageStats(db: Db): Promise<{ lang: string; lexemes: number; withCefr: number; withFrequency: number }[]> {
  const rows = await db.all<{ lang: string; lexemes: number; with_cefr: number; with_frequency: number }>(
    `SELECT lang, COUNT(*) AS lexemes, COUNT(cefr) AS with_cefr, COUNT(frequency_rank) AS with_frequency
     FROM lexemes WHERE hidden = 0 GROUP BY lang ORDER BY lang`,
  );
  return rows.map((r) => ({ lang: r.lang, lexemes: Number(r.lexemes), withCefr: Number(r.with_cefr), withFrequency: Number(r.with_frequency) }));
}
