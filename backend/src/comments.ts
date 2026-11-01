import type { Db } from "./db/index.js";
import { avatarUrl } from "./users.js";

/** Kommentar-Bäume (über parent_id) mit Bewertungen; jede Bewertung kann so selbst kommentiert und bewertet werden. */
export const COMMENT_TARGETS = ["contribution", "lexeme", "collection", "challenge"] as const;
export type CommentTarget = (typeof COMMENT_TARGETS)[number];

const MAX_BODY = 2000;
const MAX_PER_HOUR = 30;

export async function canAccessTarget(db: Db, viewer: string, type: CommentTarget, id: string): Promise<boolean> {
  switch (type) {
    case "contribution":
      return !!(await db.get("SELECT 1 AS ok FROM contributions WHERE id = ?", [Number(id) || 0]));
    case "lexeme":
      return !!(await db.get("SELECT 1 AS ok FROM lexemes WHERE id = ? AND hidden = 0", [Number(id) || 0]));
    case "collection":
      return !!(await db.get("SELECT 1 AS ok FROM public_collections WHERE id = ?", [id]));
    case "challenge":
      return !!(await db.get(
        `SELECT 1 AS ok FROM challenges c WHERE c.id = ? AND (c.kind = 'weekly' OR EXISTS (
           SELECT 1 FROM challenge_members m WHERE m.challenge_id = c.id AND m.user_id = ? AND m.status = 'accepted'))`,
        [id, viewer],
      ));
  }
}

export interface CommentView {
  id: number;
  parentId: number | null;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  body: string | null;
  createdAt: number;
  editedAt: number | null;
  score: number;
  myVote: number;
}

export async function listComments(db: Db, viewer: string, type: CommentTarget, id: string): Promise<CommentView[]> {
  const rows = await db.all<{
    id: number;
    parent_id: number | null;
    author_id: string;
    name: string;
    avatar_ext: string | null;
    avatar_version: number;
    body: string;
    created_at: number;
    edited_at: number | null;
    deleted: number;
    score: number | null;
    my_vote: number | null;
  }>(
    `SELECT c.id, c.parent_id, c.author_id, u.name, u.avatar_ext, u.avatar_version, c.body, c.created_at, c.edited_at, c.deleted,
            (SELECT SUM(v.value) FROM comment_votes v WHERE v.comment_id = c.id) AS score,
            (SELECT v.value FROM comment_votes v WHERE v.comment_id = c.id AND v.user_id = ?) AS my_vote
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.target_type = ? AND c.target_id = ? ORDER BY c.id LIMIT 500`,
    [viewer, type, id],
  );
  return rows.map((r) => {
    const deleted = Number(r.deleted) === 1;
    return {
      id: Number(r.id),
      parentId: r.parent_id === null ? null : Number(r.parent_id),
      author: deleted ? null : { id: r.author_id, name: r.name, avatarUrl: avatarUrl({ id: r.author_id, avatar_ext: r.avatar_ext, avatar_version: r.avatar_version }) },
      body: deleted ? null : r.body,
      createdAt: Number(r.created_at),
      editedAt: r.edited_at === null ? null : Number(r.edited_at),
      score: Number(r.score ?? 0),
      myVote: Number(r.my_vote ?? 0),
    };
  });
}

export type CommentResult = { ok: true; id: number } | { ok: false; status: number; error: string };

export async function addComment(
  db: Db,
  author: string,
  input: { type: CommentTarget; id: string; parentId: number | null; body: string },
  now: number,
): Promise<CommentResult> {
  const body = input.body.trim();
  if (!body || body.length > MAX_BODY) return { ok: false, status: 400, error: "invalid body" };
  if (!(await canAccessTarget(db, author, input.type, input.id))) return { ok: false, status: 404, error: "target not found" };
  const recent = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM comments WHERE author_id = ? AND created_at > ?", [author, now - 3_600_000]);
  if (Number(recent?.n ?? 0) >= MAX_PER_HOUR) return { ok: false, status: 429, error: "too many comments" };
  if (input.parentId !== null) {
    const parent = await db.get("SELECT 1 AS ok FROM comments WHERE id = ? AND target_type = ? AND target_id = ?", [input.parentId, input.type, input.id]);
    if (!parent) return { ok: false, status: 400, error: "parent not in this thread" };
  }
  const row = await db.get<{ id: number }>(
    "INSERT INTO comments (target_type, target_id, parent_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
    [input.type, input.id, input.parentId, author, body, now],
  );
  return { ok: true, id: Number(row!.id) };
}

export async function voteComment(db: Db, userId: string, commentId: number, value: number, now: number): Promise<CommentResult> {
  const c = await db.get<{ author_id: string; target_type: CommentTarget; target_id: string; deleted: number }>(
    "SELECT author_id, target_type, target_id, deleted FROM comments WHERE id = ?",
    [commentId],
  );
  if (!c || Number(c.deleted) === 1) return { ok: false, status: 404, error: "not found" };
  if (c.author_id === userId) return { ok: false, status: 403, error: "own comment" };
  if (!(await canAccessTarget(db, userId, c.target_type, c.target_id))) return { ok: false, status: 404, error: "not found" };
  if (value === 0) await db.run("DELETE FROM comment_votes WHERE comment_id = ? AND user_id = ?", [commentId, userId]);
  else {
    await db.run(
      `INSERT INTO comment_votes (comment_id, user_id, value, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (comment_id, user_id) DO UPDATE SET value = excluded.value, created_at = excluded.created_at`,
      [commentId, userId, value > 0 ? 1 : -1, now],
    );
  }
  return { ok: true, id: commentId };
}

/** Eigene Kommentare (oder als Admin) entfernen: Der Text verschwindet, Antworten bleiben im Baum. */
export async function deleteComment(db: Db, userId: string, isAdmin: boolean, commentId: number): Promise<boolean> {
  const r = await db.run(`UPDATE comments SET deleted = 1, body = '' WHERE id = ? AND (author_id = ? OR ? = 1)`, [commentId, userId, isAdmin ? 1 : 0]);
  return r.changes > 0;
}

export async function editComment(db: Db, userId: string, commentId: number, body: string, now: number): Promise<boolean> {
  const text = body.trim();
  if (!text || text.length > MAX_BODY) return false;
  const r = await db.run("UPDATE comments SET body = ?, edited_at = ? WHERE id = ? AND author_id = ? AND deleted = 0", [text, now, commentId, userId]);
  return r.changes > 0;
}
