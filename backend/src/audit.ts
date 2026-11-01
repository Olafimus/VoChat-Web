import type { Db } from "./db/index.js";

export interface AuditEntry {
  actorId: string | null;
  action: string;
  lang?: string | null;
  lexemeId?: number | null;
  itemType?: string | null;
  itemId?: string | number | null;
  details?: Record<string, unknown>;
}

/** Schreibt einen Eintrag ins Änderungsprotokoll und liefert seine ID. */
export async function logAudit(db: Db, e: AuditEntry, now: number): Promise<number> {
  const row = await db.get<{ id: number }>(
    `INSERT INTO audit_log (actor_id, action, lang, lexeme_id, item_type, item_id, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      e.actorId,
      e.action,
      e.lang ?? null,
      e.lexemeId ?? null,
      e.itemType ?? null,
      e.itemId === undefined || e.itemId === null ? null : String(e.itemId),
      e.details ? JSON.stringify(e.details) : null,
      now,
    ],
  );
  return Number(row!.id);
}

export interface AuditView {
  id: number;
  action: string;
  actor: { id: string; name: string } | null;
  lexemeId: number | null;
  itemType: string | null;
  itemId: string | null;
  details: Record<string, unknown> | null;
  at: number;
}

export async function auditHistory(db: Db, filter: { lexemeId?: number; actorId?: string; lang?: string }, limit = 100): Promise<AuditView[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.lexemeId) {
    where.push("a.lexeme_id = ?");
    params.push(filter.lexemeId);
  }
  if (filter.actorId) {
    where.push("a.actor_id = ?");
    params.push(filter.actorId);
  }
  if (filter.lang) {
    where.push("a.lang = ?");
    params.push(filter.lang);
  }
  const rows = await db.all<{
    id: number;
    action: string;
    actor_id: string | null;
    actor_name: string | null;
    lexeme_id: number | null;
    item_type: string | null;
    item_id: string | null;
    details: string | null;
    created_at: number;
  }>(
    `SELECT a.id, a.action, a.actor_id, u.name AS actor_name, a.lexeme_id, a.item_type, a.item_id, a.details, a.created_at
     FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY a.id DESC LIMIT ?`,
    [...params, limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    action: r.action,
    actor: r.actor_id ? { id: r.actor_id, name: r.actor_name ?? "?" } : null,
    lexemeId: r.lexeme_id === null ? null : Number(r.lexeme_id),
    itemType: r.item_type,
    itemId: r.item_id,
    details: r.details ? (JSON.parse(r.details) as Record<string, unknown>) : null,
    at: Number(r.created_at),
  }));
}
