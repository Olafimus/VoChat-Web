import { CEFR_LEVELS, LANG_CODES, lemmaKey, type CatalogCollection, type CatalogItem, type LangCode } from "@vochat/shared";
import type { Db, Param } from "./db/index.js";
import { browseLexemes } from "./dictionary.js";

interface PublicRow {
  id: string;
  kind: "path" | "media";
  media_type: string | null;
  lang: LangCode;
  level: CatalogCollection["level"];
  title: string;
  description: string;
  owner_name: string;
  item_count: number;
  items?: string;
  rating_avg: number | null;
  rating_count: number | null;
}

export interface CatalogFilter {
  owner?: string;
  kind?: "path" | "media";
  mediaType?: string;
  lang?: LangCode;
  q?: string;
}

const RATING_JOIN = `LEFT JOIN (
    SELECT collection_id, CAST(AVG(difficulty) AS DOUBLE PRECISION) AS rating_avg, COUNT(*) AS rating_count
    FROM ratings GROUP BY collection_id
  ) r ON r.collection_id = p.id`;

function toCatalog(row: PublicRow, withItems: boolean): CatalogCollection {
  const avg = row.rating_avg === null ? null : Math.round(Number(row.rating_avg) * 10) / 10;
  return {
    id: row.id,
    kind: row.kind,
    mediaType: row.media_type,
    title: row.title,
    description: row.description,
    lang: row.lang,
    level: row.level,
    ownerName: row.owner_name,
    itemCount: Number(row.item_count),
    rating: { average: avg, count: Number(row.rating_count ?? 0) },
    ...(withItems && row.items ? { items: JSON.parse(row.items) as CatalogItem[] } : {}),
  };
}

/** Öffentliche Sammlungen, gefiltert, nach Neuheit oder Bewertung sortiert (ohne Wortlisten). */
export async function listPublicCollections(
  db: Db,
  filter: CatalogFilter,
  sort: "new" | "rating",
  limit: number,
): Promise<CatalogCollection[]> {
  const where: string[] = [];
  const params: Param[] = [];
  const add = (sql: string, value: Param) => {
    where.push(sql);
    params.push(value);
  };
  if (filter.kind) add("p.kind = ?", filter.kind);
  if (filter.mediaType) add("p.media_type = ?", filter.mediaType);
  if (filter.lang) add("p.lang = ?", filter.lang);
  if (filter.owner) add("p.user_id = ?", filter.owner);
  if (filter.q) {
    const key = lemmaKey(filter.q);
    where.push("p.title_key LIKE ?");
    params.push(`%${key.replace(/[%_]/g, "")}%`);
  }
  const order = sort === "rating" ? "COALESCE(r.rating_avg, 0) DESC, COALESCE(r.rating_count, 0) DESC, p.updated_at DESC" : "p.updated_at DESC";
  const rows = await db.all<PublicRow>(
    `SELECT p.id, p.kind, p.media_type, p.lang, p.level, p.title, p.description, p.owner_name, p.item_count,
            r.rating_avg, r.rating_count
     FROM public_collections p ${RATING_JOIN}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY ${order} LIMIT ?`,
    [...params, limit],
  );
  return rows.map((r) => toCatalog(r, false));
}

export async function getPublicCollection(db: Db, id: string): Promise<CatalogCollection | null> {
  const row = await db.get<PublicRow>(
    `SELECT p.id, p.kind, p.media_type, p.lang, p.level, p.title, p.description, p.owner_name, p.item_count, p.items,
            r.rating_avg, r.rating_count
     FROM public_collections p ${RATING_JOIN} WHERE p.id = ?`,
    [id],
  );
  return row ? toCatalog(row, true) : null;
}

export async function upsertRating(db: Db, collectionId: string, userId: string, difficulty: number, now: number): Promise<boolean> {
  const exists = await db.get("SELECT 1 AS ok FROM public_collections WHERE id = ?", [collectionId]);
  if (!exists) return false;
  await db.run(
    `INSERT INTO ratings (collection_id, user_id, difficulty, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (collection_id, user_id) DO UPDATE SET difficulty = excluded.difficulty, created_at = excluded.created_at`,
    [collectionId, userId, difficulty, now],
  );
  return true;
}

export async function myRating(db: Db, collectionId: string, userId: string): Promise<number | null> {
  const row = await db.get<{ difficulty: number }>("SELECT difficulty FROM ratings WHERE collection_id = ? AND user_id = ?", [
    collectionId,
    userId,
  ]);
  return row ? Number(row.difficulty) : null;
}

/**
 * Empfohlene Lernpfade je Sprache, aus dem Wörterbuch abgeleitet: ein Pfad je CEFR-Niveau
 * mit Daten, dazu „Top 500“ nach Häufigkeit. Berechnet, nicht gespeichert.
 */
export async function builtinPaths(db: Db, lang: LangCode): Promise<CatalogCollection[]> {
  const levels = await db.all<{ cefr: string; n: number }>(
    "SELECT cefr, COUNT(*) AS n FROM lexemes WHERE lang = ? AND hidden = 0 AND cefr IS NOT NULL GROUP BY cefr ORDER BY cefr",
    [lang],
  );
  const paths: CatalogCollection[] = levels.map((l) => ({
    id: `builtin:${lang}:${l.cefr}`,
    kind: "path",
    mediaType: null,
    title: `${lang.toUpperCase()} ${l.cefr}: Grundwortschatz`,
    description: `Die häufigsten ${l.cefr}-Wörter (${Number(l.n)} verfügbar).`,
    lang,
    level: l.cefr as (typeof CEFR_LEVELS)[number],
    ownerName: "VoChat",
    itemCount: Math.min(300, Number(l.n)),
    rating: { average: null, count: 0 },
  }));
  paths.push({
    id: `builtin:${lang}:top500`,
    kind: "path",
    mediaType: null,
    title: `${lang.toUpperCase()}: Top 500 Wörter`,
    description: "Die 500 häufigsten Wörter nach Korpus-Frequenz.",
    lang,
    level: null,
    ownerName: "VoChat",
    itemCount: 500,
    rating: { average: null, count: 0 },
  });
  return paths;
}

export async function builtinPathDetail(db: Db, id: string, nativeLang: LangCode): Promise<CatalogCollection | null> {
  const [prefix, lang, level] = id.split(":");
  if (prefix !== "builtin" || !LANG_CODES.includes(lang as LangCode)) return null;
  const isTop = level === "top500";
  if (!isTop && !(CEFR_LEVELS as readonly string[]).includes(level)) return null;
  const base = (await builtinPaths(db, lang as LangCode)).find((p) => p.id === id);
  if (!base) return null;
  const rows = await browseLexemes(db, {
    lang: lang as LangCode,
    nativeLang,
    cefr: isTop ? undefined : (level as (typeof CEFR_LEVELS)[number]),
    limit: isTop ? 500 : 300,
    offset: 0,
  });
  return {
    ...base,
    items: rows.map((r) => ({ lemma: r.lemma, lang: r.lang, lexemeId: r.id, gloss: r.gloss, pronunciation: r.romanization, cefr: r.cefr })),
  };
}
