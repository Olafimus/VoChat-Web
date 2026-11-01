import type { Cefr, ExtractResult, LangCode, LexemeDetail, LexemeSummary } from "@vochat/shared";
import type { Db } from "./db.js";

type SummaryRow = {
  id: number;
  lang: string;
  lemma: string;
  pos: string;
  gender: string | null;
  cefr: string | null;
  frequency_rank: number | null;
  gloss: string | null;
  translation: string | null;
};

const SUMMARY_SELECT = `
  SELECT l.id, l.lang, l.lemma, l.pos, l.gender, l.cefr, l.frequency_rank,
    (SELECT s.gloss FROM senses s WHERE s.lexeme_id = l.id AND s.hidden = 0 AND s.gloss_lang = :native
      ORDER BY s.position LIMIT 1) AS gloss,
    (SELECT t.target_lemma FROM translations t WHERE t.lexeme_id = l.id AND t.hidden = 0 AND t.target_lang = :native
      ORDER BY t.id LIMIT 1) AS translation
  FROM lexemes l`;

function toSummary(row: SummaryRow): LexemeSummary {
  return {
    id: row.id,
    lang: row.lang as LangCode,
    lemma: row.lemma,
    pos: row.pos || null,
    gender: row.gender,
    cefr: row.cefr,
    frequencyRank: row.frequency_rank,
    gloss: row.gloss ?? row.translation,
  };
}

/**
 * Persische Schreibvarianten: Häufigkeitslisten nutzen oft arabische Zeichen (ي, ك),
 * Tastaturen und Vokabellisten persische (ی, ک). Die Suche probiert alle Kombinationen.
 */
export function persianVariants(q: string): string[] {
  const variants = new Set<string>([q]);
  for (const v of [...variants]) {
    variants.add(v.replace(/ی/g, "ي").replace(/ک/g, "ك"));
    variants.add(v.replace(/ي/g, "ی").replace(/ك/g, "ک"));
  }
  return [...variants];
}

/** Präfix-Suche (Groß-/Kleinschreibung egal), exakte Treffer zuerst, dann nach Häufigkeit. */
export function searchLexemes(
  db: Db,
  opts: { lang: LangCode; q: string; nativeLang: LangCode; limit: number },
): LexemeSummary[] {
  const q = opts.q.normalize("NFC").trim();
  if (!q) return [];
  const variants = opts.lang === "fa" ? persianVariants(q) : [q];
  const ranges = variants.map(() => "(l.lemma COLLATE NOCASE >= ? AND l.lemma COLLATE NOCASE < ?)").join(" OR ");
  const exactList = variants.map(() => "?").join(", ");
  // Positionsparameter in der Reihenfolge ihres Auftretens im SQL.
  const params = [
    opts.nativeLang, // gloss-Subquery
    opts.nativeLang, // translation-Subquery
    opts.lang,
    ...variants.flatMap((v) => [v, v + "\uffff"]),
    ...variants,
    opts.limit,
  ];
  const rows = db
    .prepare(
      `${SUMMARY_SELECT.replaceAll(":native", "?")}
       WHERE l.lang = ? AND l.hidden = 0 AND (${ranges})
       ORDER BY (l.lemma COLLATE NOCASE IN (${exactList})) DESC, l.frequency_rank IS NULL, l.frequency_rank, l.lemma
       LIMIT ?`,
    )
    .all(...params) as SummaryRow[];
  return rows.map(toSummary);
}

/** Durchstöbern nach Sprache, optionalem CEFR-Niveau und Häufigkeit. */
export function browseLexemes(
  db: Db,
  opts: { lang: LangCode; nativeLang: LangCode; cefr?: Cefr; limit: number; offset: number },
): LexemeSummary[] {
  const rows = db
    .prepare(
      `${SUMMARY_SELECT}
       WHERE l.lang = :lang AND l.hidden = 0 AND (:cefr IS NULL OR l.cefr = :cefr)
       ORDER BY l.frequency_rank IS NULL, l.frequency_rank, l.lemma
       LIMIT :limit OFFSET :offset`,
    )
    .all({
      native: opts.nativeLang,
      lang: opts.lang,
      cefr: opts.cefr ?? null,
      limit: opts.limit,
      offset: opts.offset,
    }) as SummaryRow[];
  return rows.map(toSummary);
}

export function lexemeDetail(db: Db, id: number, nativeLang: LangCode): LexemeDetail | null {
  const row = db.prepare(`${SUMMARY_SELECT} WHERE l.id = :id AND l.hidden = 0`).get({ native: nativeLang, id }) as SummaryRow | undefined;
  if (!row) return null;
  const extra = db.prepare("SELECT romanization FROM lexemes WHERE id = ?").get(id) as { romanization: string | null };

  const senses = db
    .prepare("SELECT position, gloss_lang, gloss, source FROM senses WHERE lexeme_id = ? AND hidden = 0 ORDER BY gloss_lang = ? DESC, position LIMIT 40")
    .all(id, nativeLang) as { position: number; gloss_lang: string; gloss: string; source: string }[];
  const examples = db
    .prepare("SELECT text, translation, translation_lang, source FROM examples WHERE lexeme_id = ? AND hidden = 0 ORDER BY id LIMIT 30")
    .all(id) as { text: string; translation: string | null; translation_lang: string | null; source: string }[];
  const translations = db
    .prepare("SELECT target_lang, target_lemma, source FROM translations WHERE lexeme_id = ? AND hidden = 0 ORDER BY target_lang = ? DESC, id LIMIT 60")
    .all(id, nativeLang) as { target_lang: string; target_lemma: string; source: string }[];
  const categories = db
    .prepare(
      `SELECT c.name, c.kind FROM lexeme_categories lc JOIN categories c ON c.id = lc.category_id
       WHERE lc.lexeme_id = ? ORDER BY c.kind, c.name`,
    )
    .all(id) as { name: string; kind: string }[];

  return {
    ...toSummary(row),
    romanization: extra.romanization,
    senses: senses.map((s) => ({ position: s.position, glossLang: s.gloss_lang, gloss: s.gloss, source: s.source })),
    examples: examples.map((e) => ({
      text: e.text,
      translation: e.translation,
      translationLang: e.translation_lang,
      source: e.source,
    })),
    translations: translations.map((t) => ({
      targetLang: t.target_lang as LangCode,
      targetLemma: t.target_lemma,
      source: t.source,
    })),
    categories,
  };
}

export function languageStats(db: Db): { lang: string; lexemes: number; withCefr: number; withFrequency: number }[] {
  return db
    .prepare(
      `SELECT lang, COUNT(*) AS lexemes,
         SUM(cefr IS NOT NULL) AS withCefr,
         SUM(frequency_rank IS NOT NULL) AS withFrequency
       FROM lexemes WHERE hidden = 0 GROUP BY lang ORDER BY lang`,
    )
    .all() as { lang: string; lexemes: number; withCefr: number; withFrequency: number }[];
}

/**
 * Wörter aus einem Text extrahieren: Buchstabenfolgen (Unicode), kleingeschrieben und
 * dedupliziert. Treffer werden exakt (Groß-/Kleinschreibung egal, persische Varianten) gesucht.
 */
export function extractWords(db: Db, lang: LangCode, text: string, nativeLang: LangCode, limit = 80): ExtractResult {
  const tokens = [...new Set((text.normalize("NFC").match(/\p{L}[\p{L}\p{M}'’-]*/gu) ?? []).map((t) => t.replace(/[’-]/g, "'")))].slice(0, limit);
  const matches: LexemeSummary[] = [];
  const unknown: string[] = [];
  const seen = new Set<number>();
  for (const token of tokens) {
    const hit = searchLexemes(db, { lang, q: token, nativeLang, limit: 3 }).find(
      (r) => r.lemma.toLocaleLowerCase("de") === token.toLocaleLowerCase("de") || persianVariants(token).includes(r.lemma),
    );
    if (hit && !seen.has(hit.id)) {
      seen.add(hit.id);
      matches.push(hit);
    } else if (!hit) unknown.push(token);
  }
  return { matches, unknown };
}
