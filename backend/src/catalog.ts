import { CEFR_LEVELS, LANG_CODES, type CatalogCollection, type LangCode } from "@vochat/shared";
import type { Db } from "./db.js";
import { browseLexemes } from "./dictionary.js";

interface StoredCollection {
  id: string;
  kind: "path" | "media";
  mediaType: CatalogCollection["mediaType"];
  title: string;
  description: string;
  lang: LangCode;
  level: CatalogCollection["level"];
  ownerName: string;
  items: { lemma: string; lang: LangCode; lexemeId: number | null; gloss: string | null; cefr: string | null }[];
  visibility: "private" | "public";
  deleted: boolean;
}

export interface CatalogFilter {
  kind?: "path" | "media";
  mediaType?: string;
  lang?: LangCode;
  q?: string;
}

const ratingStats = (db: Db, id: string) =>
  db
    .prepare("SELECT AVG(difficulty) AS average, COUNT(*) AS count FROM ratings WHERE collection_id = ?")
    .get(id) as { average: number | null; count: number };

const toCatalog = (c: StoredCollection, db: Db, withItems: boolean): CatalogCollection => ({
  id: c.id,
  kind: c.kind,
  mediaType: c.mediaType,
  title: c.title,
  description: c.description,
  lang: c.lang,
  level: c.level,
  ownerName: c.ownerName,
  itemCount: c.items.length,
  rating: (() => {
    const s = ratingStats(db, c.id);
    return { average: s.average === null ? null : Math.round(s.average * 10) / 10, count: s.count };
  })(),
  ...(withItems ? { items: c.items } : {}),
});

/** Öffentliche Sammlungen aus dem Sync-Speicher, gefiltert und nach Bewertung sortierbar. */
export function listPublicCollections(db: Db, filter: CatalogFilter, sort: "new" | "rating", limit: number): CatalogCollection[] {
  const rows = db
    .prepare(
      `SELECT data FROM sync_rows
       WHERE entity = 'collections' AND deleted = 0
         AND json_extract(data, '$.visibility') = 'public'
         AND (:kind IS NULL OR json_extract(data, '$.kind') = :kind)
         AND (:mediaType IS NULL OR json_extract(data, '$.mediaType') = :mediaType)
         AND (:lang IS NULL OR json_extract(data, '$.lang') = :lang)
         AND (:q IS NULL OR json_extract(data, '$.title') LIKE :qLike)
       ORDER BY updated_at DESC
       LIMIT 500`,
    )
    .all({
      kind: filter.kind ?? null,
      mediaType: filter.mediaType ?? null,
      lang: filter.lang ?? null,
      q: filter.q ?? null,
      qLike: filter.q ? `%${filter.q}%` : null,
    }) as { data: string }[];
  const items = rows.map((r) => toCatalog(JSON.parse(r.data) as StoredCollection, db, false));
  if (sort === "rating") {
    items.sort((a, b) => (b.rating.average ?? 0) - (a.rating.average ?? 0) || b.rating.count - a.rating.count);
  }
  return items.slice(0, limit);
}

export function getPublicCollection(db: Db, id: string): CatalogCollection | null {
  const row = db
    .prepare(
      `SELECT data FROM sync_rows WHERE entity = 'collections' AND id = ? AND deleted = 0
         AND json_extract(data, '$.visibility') = 'public'`,
    )
    .get(id) as { data: string } | undefined;
  return row ? toCatalog(JSON.parse(row.data) as StoredCollection, db, true) : null;
}

export function upsertRating(db: Db, collectionId: string, userId: string, difficulty: number, now: number): boolean {
  if (!getPublicCollection(db, collectionId)) return false;
  db.prepare(
    `INSERT INTO ratings (collection_id, user_id, difficulty, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (collection_id, user_id) DO UPDATE SET difficulty = excluded.difficulty, created_at = excluded.created_at`,
  ).run(collectionId, userId, difficulty, now);
  return true;
}

export function myRating(db: Db, collectionId: string, userId: string): number | null {
  const row = db.prepare("SELECT difficulty FROM ratings WHERE collection_id = ? AND user_id = ?").get(collectionId, userId) as
    | { difficulty: number }
    | undefined;
  return row?.difficulty ?? null;
}

/**
 * Empfohlene Lernpfade je Sprache, aus dem Wörterbuch abgeleitet: ein Pfad je
 * CEFR-Niveau mit Daten, dazu „Top 500“ nach Häufigkeit. Die Pfade sind nicht
 * gespeichert, sondern werden bei Bedarf berechnet.
 */
export function builtinPaths(db: Db, lang: LangCode): CatalogCollection[] {
  const levels = db
    .prepare("SELECT cefr, COUNT(*) AS n FROM lexemes WHERE lang = ? AND hidden = 0 AND cefr IS NOT NULL GROUP BY cefr ORDER BY cefr")
    .all(lang) as { cefr: string; n: number }[];
  const paths: CatalogCollection[] = levels.map((l) => ({
    id: `builtin:${lang}:${l.cefr}`,
    kind: "path",
    mediaType: null,
    title: `${lang.toUpperCase()} ${l.cefr}: Grundwortschatz`,
    description: `Die häufigsten ${l.cefr}-Wörter (${l.n} verfügbar).`,
    lang,
    level: l.cefr as (typeof CEFR_LEVELS)[number],
    ownerName: "VoChat",
    itemCount: Math.min(300, l.n),
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

export function builtinPathDetail(db: Db, id: string, nativeLang: LangCode): CatalogCollection | null {
  const [, lang, level] = id.split(":");
  if (id.startsWith("builtin:") === false || !LANG_CODES.includes(lang as LangCode)) return null;
  const isTop = level === "top500";
  if (!isTop && !(CEFR_LEVELS as readonly string[]).includes(level)) return null;
  const rows = browseLexemes(db, {
    lang: lang as LangCode,
    nativeLang,
    cefr: isTop ? undefined : (level as (typeof CEFR_LEVELS)[number]),
    limit: isTop ? 500 : 300,
    offset: 0,
  });
  const base = builtinPaths(db, lang as LangCode).find((p) => p.id === id);
  if (!base) return null;
  return {
    ...base,
    items: rows.map((r) => ({
      lemma: r.lemma,
      lang: r.lang,
      lexemeId: r.id,
      gloss: r.gloss,
      cefr: r.cefr,
    })),
  };
}

