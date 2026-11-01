import {
  cardSchema,
  collectionSchema,
  lemmaKey,
  messageSchema,
  reviewSchema,
  type Collection,
  type PullResponse,
  type PushResponse,
  type SyncEntity,
} from "@vochat/shared";
import type { Db } from "./db/index.js";

const schemas = { cards: cardSchema, messages: messageSchema, reviews: reviewSchema, collections: collectionSchema } as const;

/** Kleines Merkmal je Entität für Auswertungen ohne JSON-Funktionen (Karten: Lernstatus). */
const attrOf = (entity: SyncEntity, row: Record<string, unknown>): string | null =>
  entity === "cards" ? String(row.status ?? "") || null : null;

/**
 * Push: Last-Write-Wins pro Zeile anhand `updatedAt`. Ältere Änderungen werden verworfen
 * (der Client holt beim nächsten Pull den neueren Stand). Jede angenommene Zeile erhält eine
 * neue globale Sequenznummer. Die Zeilensperre auf dem Zähler serialisiert gleichzeitige Pushes,
 * damit Commit-Reihenfolge und Sequenz übereinstimmen.
 */
export async function pushOps(db: Db, userId: string, ops: { entity: string; row: unknown }[]): Promise<PushResponse> {
  const rejected: PushResponse["rejected"] = [];
  let accepted = 0;

  await db.tx(async (t) => {
    for (const op of ops) {
      const rawId = (op.row as { id?: unknown } | null)?.id;
      const id = typeof rawId === "string" ? rawId : "";
      if (!(op.entity in schemas)) {
        rejected.push({ id, reason: "unknown entity" });
        continue;
      }
      const entity = op.entity as SyncEntity;
      const parsed = schemas[entity].safeParse(op.row);
      if (!parsed.success) {
        rejected.push({ id, reason: "invalid row" });
        continue;
      }
      const row = parsed.data as { id: string; updatedAt: number; deleted: boolean } & Record<string, unknown>;
      // Zuerst die Sequenz ziehen: Das sperrt die Zählerzeile bis zum Commit. Gleichzeitige Pushes
      // warten hier, und die folgende Leseabfrage sieht danach den bereits festgeschriebenen Stand.
      const seq = (await t.get<{ value: number }>("UPDATE counters SET value = value + 1 WHERE name = 'seq' RETURNING value"))!.value;
      const existing = await t.get<{ updated_at: number }>(
        "SELECT updated_at FROM sync_rows WHERE user_id = ? AND entity = ? AND id = ?",
        [userId, entity, row.id],
      );
      if (existing && Number(existing.updated_at) > row.updatedAt) continue; // Server-Stand ist neuer
      await t.run(
        `INSERT INTO sync_rows (user_id, entity, id, data, attr, updated_at, deleted, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (user_id, entity, id) DO UPDATE SET
           data = excluded.data, attr = excluded.attr, updated_at = excluded.updated_at,
           deleted = excluded.deleted, seq = excluded.seq
         WHERE sync_rows.updated_at <= excluded.updated_at`,
        [userId, entity, row.id, JSON.stringify(row), attrOf(entity, row), row.updatedAt, row.deleted ? 1 : 0, seq],
      );
      if (entity === "collections") await syncPublicCollection(t, userId, row as unknown as Collection);
      accepted++;
    }
  });

  const cursor = await db.get<{ seq: number | null }>("SELECT MAX(seq) AS seq FROM sync_rows WHERE user_id = ?", [userId]);
  return { accepted, rejected, cursor: Number(cursor?.seq ?? 0) };
}

/** Hält die Tabelle der öffentlichen Sammlungen aktuell: öffentlich & nicht gelöscht -> eintragen, sonst entfernen. */
export async function syncPublicCollection(db: Db, userId: string, c: Collection): Promise<void> {
  if (c.visibility !== "public" || c.deleted) {
    await db.run("DELETE FROM public_collections WHERE id = ? AND user_id = ?", [c.id, userId]);
    return;
  }
  await db.run(
    `INSERT INTO public_collections (id, user_id, kind, media_type, lang, level, title, title_key, description, owner_name, item_count, items, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       kind = excluded.kind, media_type = excluded.media_type, lang = excluded.lang, level = excluded.level,
       title = excluded.title, title_key = excluded.title_key, description = excluded.description,
       owner_name = excluded.owner_name, item_count = excluded.item_count, items = excluded.items, updated_at = excluded.updated_at
     WHERE public_collections.user_id = excluded.user_id`,
    [
      c.id,
      userId,
      c.kind,
      c.mediaType,
      c.lang,
      c.level,
      c.title,
      lemmaKey(c.title),
      c.description,
      c.ownerName,
      c.items.length,
      JSON.stringify(c.items),
      c.updatedAt,
    ],
  );
}

export async function pullChanges(db: Db, userId: string, since: number, limit: number): Promise<PullResponse> {
  const rows = await db.all<{ entity: SyncEntity; data: string; seq: number }>(
    "SELECT entity, data, seq FROM sync_rows WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?",
    [userId, since, limit + 1],
  );
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const cursor = page.length > 0 ? Number(page[page.length - 1].seq) : since;
  return {
    changes: page.map((r) => ({ entity: r.entity, row: JSON.parse(r.data) as Record<string, unknown> })),
    cursor,
    hasMore,
  };
}
