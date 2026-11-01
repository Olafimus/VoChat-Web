import { cardSchema, messageSchema, type PullResponse, type PushResponse, type SyncEntity } from "@vochat/shared";
import { transaction, type Db } from "./db.js";

const schemas = { cards: cardSchema, messages: messageSchema } as const;

/**
 * Push: Last-Write-Wins pro Zeile anhand `updatedAt`. Ältere Änderungen werden
 * verworfen (der Client holt beim nächsten Pull den neueren Stand). Jede
 * angenommene Zeile erhält eine neue globale Sequenznummer für den Pull.
 */
export function pushOps(db: Db, userId: string, ops: { entity: string; row: unknown }[]): PushResponse {
  const rejected: PushResponse["rejected"] = [];
  let accepted = 0;

  transaction(db, () => {
    const findStmt = db.prepare("SELECT updated_at FROM sync_rows WHERE user_id = ? AND entity = ? AND id = ?");
    const nextSeq = db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'seq' RETURNING value");
    const upsert = db.prepare(
      `INSERT INTO sync_rows (user_id, entity, id, data, updated_at, deleted, seq)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, entity, id) DO UPDATE SET
         data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted, seq = excluded.seq`,
    );

    for (const op of ops) {
      const rawId = (op.row as { id?: unknown } | null)?.id;
      const id = typeof rawId === "string" ? rawId : "";
      if (!(op.entity in schemas)) {
        rejected.push({ id, reason: "unknown entity" });
        continue;
      }
      const schema = schemas[op.entity as SyncEntity];
      const parsed = schema.safeParse(op.row);
      if (!parsed.success) {
        rejected.push({ id, reason: "invalid row" });
        continue;
      }
      const row = parsed.data as { id: string; updatedAt: number; deleted: boolean };
      const existing = findStmt.get(userId, op.entity, row.id) as { updated_at: number } | undefined;
      if (existing && existing.updated_at > row.updatedAt) continue; // Server-Stand ist neuer
      const seq = (nextSeq.get() as { value: number }).value;
      upsert.run(userId, op.entity, row.id, JSON.stringify(row), row.updatedAt, row.deleted ? 1 : 0, seq);
      accepted++;
    }
  });

  return { accepted, rejected, cursor: currentCursor(db, userId) };
}

export function pullChanges(db: Db, userId: string, since: number, limit: number): PullResponse {
  const rows = db
    .prepare(`SELECT entity, data, seq FROM sync_rows WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?`)
    .all(userId, since, limit + 1) as { entity: SyncEntity; data: string; seq: number }[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const cursor = page.length > 0 ? page[page.length - 1].seq : since;
  return {
    changes: page.map((r) => ({ entity: r.entity, row: JSON.parse(r.data) as Record<string, unknown> })),
    cursor,
    hasMore,
  };
}

function currentCursor(db: Db, userId: string): number {
  const row = db.prepare("SELECT MAX(seq) AS seq FROM sync_rows WHERE user_id = ?").get(userId) as { seq: number | null };
  return row.seq ?? 0;
}
