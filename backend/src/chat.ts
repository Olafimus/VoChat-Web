import { randomBytes, randomUUID } from "node:crypto";
import type { Db } from "./db/index.js";
import { sniffImage, type MediaStore } from "./media.js";
import { sniffAudio } from "./recordings.js";
import { friendState } from "./social.js";
import { avatarUrl, signMedia } from "./users.js";

/**
 * Chats zwischen Nutzern. Direktchats nur zwischen Freunden, Gruppen nur mit Freunden der
 * Gründerin. Nachrichten: Text (≤ 4000 Zeichen), Bild (≤ 5 MB, JPEG/PNG/WebP/GIF) oder
 * Sprachnachricht (≤ 2 MB, ≤ 3 Min.). Medien liegen im Medien-Speicher unter zufälligem Namen
 * und werden nur über signierte Links ausgeliefert, die Mitglieder von der API erhalten.
 */
export const MAX_TEXT = 4000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VOICE_BYTES = 2 * 1024 * 1024;
export const MAX_VOICE_MS = 180_000;
const MESSAGES_PER_MINUTE = 60;
const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const EMOJI = /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️){1,16}$/u;

export type ChatKind = "text" | "image" | "voice";

export interface ChatMember {
  id: string;
  name: string;
  avatarUrl: string | null;
  lastReadId: number;
}

export interface ConversationView {
  id: string;
  kind: "dm" | "group";
  title: string;
  members: ChatMember[];
  lastMessage: { id: number; authorId: string | null; preview: string; at: number } | null;
  unread: number;
  lastMessageAt: number;
}

export interface MessageView {
  id: number;
  conversationId: string;
  authorId: string | null;
  kind: ChatKind;
  body: string;
  replyTo: { id: number; authorId: string | null; preview: string } | null;
  media: { url: string; type: string; width?: number; height?: number; durationMs?: number } | null;
  correction: { body: string; byId: string | null } | null;
  reactions: { emoji: string; count: number; mine: boolean }[];
  createdAt: number;
  editedAt: number | null;
  deleted: boolean;
  clientId: string | null;
}

type Fail = { ok: false; status: 400 | 403 | 404 | 409 | 413 | 415 | 429; error: string };
const fail = (status: Fail["status"], error: string): Fail => ({ ok: false, status, error });

export async function isMember(db: Db, conversationId: string, userId: string): Promise<boolean> {
  return !!(await db.get("SELECT 1 AS ok FROM conversation_members WHERE conversation_id = ? AND user_id = ?", [conversationId, userId]));
}

export async function memberIds(db: Db, conversationId: string): Promise<string[]> {
  return (await db.all<{ user_id: string }>("SELECT user_id FROM conversation_members WHERE conversation_id = ?", [conversationId])).map(
    (r) => r.user_id,
  );
}

export async function openDm(db: Db, me: string, other: string, now: number): Promise<{ ok: true; id: string } | Fail> {
  if (me === other) return fail(400, "cannot chat with yourself");
  if ((await friendState(db, me, other)) !== "accepted") return fail(403, "only friends can chat");
  const key = [me, other].sort().join(":");
  const existing = await db.get<{ id: string }>("SELECT id FROM conversations WHERE dm_key = ?", [key]);
  if (existing) return { ok: true, id: existing.id };
  const id = randomUUID();
  await db.tx(async (t) => {
    await t.run("INSERT INTO conversations (id, kind, title, dm_key, created_by, created_at, last_message_at) VALUES (?, 'dm', NULL, ?, ?, ?, ?)", [
      id,
      key,
      me,
      now,
      now,
    ]);
    for (const u of [me, other]) {
      await t.run("INSERT INTO conversation_members (conversation_id, user_id, joined_at, last_read_id) VALUES (?, ?, ?, 0)", [id, u, now]);
    }
  });
  return { ok: true, id };
}

export async function createGroup(db: Db, me: string, title: string, members: string[], now: number): Promise<{ ok: true; id: string } | Fail> {
  const unique = [...new Set(members.filter((m) => m !== me))];
  if (!title.trim() || title.length > 80) return fail(400, "invalid title");
  if (unique.length < 1 || unique.length > 30) return fail(400, "1–30 members");
  for (const m of unique) if ((await friendState(db, me, m)) !== "accepted") return fail(403, "only friends can be added");
  const id = randomUUID();
  await db.tx(async (t) => {
    await t.run("INSERT INTO conversations (id, kind, title, dm_key, created_by, created_at, last_message_at) VALUES (?, 'group', ?, NULL, ?, ?, ?)", [
      id,
      title.trim(),
      me,
      now,
      now,
    ]);
    for (const u of [me, ...unique]) {
      await t.run("INSERT INTO conversation_members (conversation_id, user_id, joined_at, last_read_id) VALUES (?, ?, ?, 0)", [id, u, now]);
    }
  });
  return { ok: true, id };
}

const preview = (kind: string, body: string, deleted: number | boolean) =>
  Number(deleted) ? "Nachricht gelöscht" : kind === "image" ? `📷 ${body || "Bild"}` : kind === "voice" ? "🎤 Sprachnachricht" : body.slice(0, 120);

export async function listConversations(db: Db, me: string): Promise<ConversationView[]> {
  const convs = await db.all<{ id: string; kind: "dm" | "group"; title: string | null; last_message_at: number; last_read_id: number }>(
    `SELECT c.id, c.kind, c.title, c.last_message_at, m.last_read_id
     FROM conversations c JOIN conversation_members m ON m.conversation_id = c.id AND m.user_id = ?
     ORDER BY c.last_message_at DESC LIMIT 200`,
    [me],
  );
  if (convs.length === 0) return [];
  const ids = convs.map((c) => c.id);
  const marks = ids.map(() => "?").join(",");
  const [members, lasts, unread] = await Promise.all([
    db.all<{ conversation_id: string; id: string; name: string; avatar_ext: string | null; avatar_version: number; last_read_id: number }>(
      `SELECT m.conversation_id, u.id, u.name, u.avatar_ext, u.avatar_version, m.last_read_id
       FROM conversation_members m JOIN users u ON u.id = m.user_id WHERE m.conversation_id IN (${marks})`,
      ids,
    ),
    db.all<{ conversation_id: string; id: number; author_id: string | null; kind: string; body: string; deleted: number; created_at: number }>(
      `SELECT x.conversation_id, x.id, x.author_id, x.kind, x.body, x.deleted, x.created_at FROM chat_messages x
       WHERE x.id IN (SELECT MAX(id) FROM chat_messages WHERE conversation_id IN (${marks}) GROUP BY conversation_id)`,
      ids,
    ),
    db.all<{ conversation_id: string; n: number }>(
      `SELECT x.conversation_id, COUNT(*) AS n FROM chat_messages x
       JOIN conversation_members m ON m.conversation_id = x.conversation_id AND m.user_id = ?
       WHERE x.conversation_id IN (${marks}) AND x.id > m.last_read_id AND x.deleted = 0
         AND (x.author_id IS NULL OR x.author_id <> ?)
       GROUP BY x.conversation_id`,
      [me, ...ids, me],
    ),
  ]);
  return convs.map((c) => {
    const ms = members
      .filter((m) => m.conversation_id === c.id)
      .map((m) => ({ id: m.id, name: m.name, avatarUrl: avatarUrl(m), lastReadId: Number(m.last_read_id) }));
    const last = lasts.find((l) => l.conversation_id === c.id);
    const others = ms.filter((m) => m.id !== me);
    return {
      id: c.id,
      kind: c.kind,
      title: c.kind === "group" ? (c.title ?? "Gruppe") : (others[0]?.name ?? "Chat"),
      members: ms,
      lastMessage: last
        ? { id: Number(last.id), authorId: last.author_id, preview: preview(last.kind, last.body, last.deleted), at: Number(last.created_at) }
        : null,
      unread: Number(unread.find((u) => u.conversation_id === c.id)?.n ?? 0),
      lastMessageAt: Number(c.last_message_at),
    };
  });
}

type MessageRow = {
  id: number;
  conversation_id: string;
  author_id: string | null;
  kind: ChatKind;
  body: string;
  reply_to: number | null;
  media_key: string | null;
  media_type: string | null;
  media_meta: string | null;
  correction: string | null;
  corrected_by: string | null;
  created_at: number;
  edited_at: number | null;
  deleted: number;
  client_id: string | null;
};

const mediaUrl = (key: string) => `/media/chat/${key.slice("chat/".length)}?s=${signMedia(key)}`;

async function hydrate(db: Db, me: string, rows: MessageRow[]): Promise<MessageView[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => Number(r.id));
  const replyIds = [...new Set(rows.map((r) => r.reply_to).filter((x): x is number => x !== null).map(Number))];
  const [reactions, replies] = await Promise.all([
    db.all<{ message_id: number; emoji: string; n: number; mine: number }>(
      `SELECT message_id, emoji, COUNT(*) AS n, SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine
       FROM chat_reactions WHERE message_id IN (${ids.map(() => "?").join(",")}) GROUP BY message_id, emoji`,
      [me, ...ids],
    ),
    replyIds.length
      ? db.all<{ id: number; author_id: string | null; kind: string; body: string; deleted: number }>(
          `SELECT id, author_id, kind, body, deleted FROM chat_messages WHERE id IN (${replyIds.map(() => "?").join(",")})`,
          replyIds,
        )
      : Promise.resolve([]),
  ]);
  return rows.map((r) => {
    const deleted = Number(r.deleted) === 1;
    const reply = r.reply_to !== null ? replies.find((x) => Number(x.id) === Number(r.reply_to)) : undefined;
    const meta = r.media_meta ? (JSON.parse(r.media_meta) as { width?: number; height?: number; durationMs?: number }) : {};
    return {
      id: Number(r.id),
      conversationId: r.conversation_id,
      authorId: r.author_id,
      kind: r.kind,
      body: deleted ? "" : r.body,
      replyTo: reply ? { id: Number(reply.id), authorId: reply.author_id, preview: preview(reply.kind, reply.body, reply.deleted) } : null,
      media: !deleted && r.media_key ? { url: mediaUrl(r.media_key), type: r.media_type ?? "", ...meta } : null,
      correction: !deleted && r.correction ? { body: r.correction, byId: r.corrected_by } : null,
      reactions: deleted
        ? []
        : reactions
            .filter((x) => Number(x.message_id) === Number(r.id))
            .map((x) => ({ emoji: x.emoji, count: Number(x.n), mine: Number(x.mine) > 0 })),
      createdAt: Number(r.created_at),
      editedAt: r.edited_at === null ? null : Number(r.edited_at),
      deleted,
      clientId: r.client_id,
    };
  });
}

const SELECT = `SELECT id, conversation_id, author_id, kind, body, reply_to, media_key, media_type, media_meta, correction, corrected_by,
  created_at, edited_at, deleted, client_id FROM chat_messages`;

/** Seitenweise: `before` lädt ältere (neueste zuerst), `after` neuere (älteste zuerst). */
export async function listMessages(
  db: Db,
  me: string,
  conversationId: string,
  opts: { before?: number; after?: number; limit: number },
): Promise<MessageView[] | null> {
  if (!(await isMember(db, conversationId, me))) return null;
  const limit = Math.min(100, Math.max(1, opts.limit));
  const rows =
    opts.after !== undefined
      ? await db.all<MessageRow>(`${SELECT} WHERE conversation_id = ? AND id > ? ORDER BY id LIMIT ?`, [conversationId, opts.after, limit])
      : opts.before !== undefined
        ? await db.all<MessageRow>(`${SELECT} WHERE conversation_id = ? AND id < ? ORDER BY id DESC LIMIT ?`, [conversationId, opts.before, limit])
        : await db.all<MessageRow>(`${SELECT} WHERE conversation_id = ? ORDER BY id DESC LIMIT ?`, [conversationId, limit]);
  return hydrate(db, me, rows);
}

/** Geänderte Nachrichten (Reaktion, Korrektur, Bearbeitung, Löschung) nachladen. */
export async function messagesByIds(db: Db, me: string, conversationId: string, ids: number[]): Promise<MessageView[] | null> {
  if (!(await isMember(db, conversationId, me))) return null;
  const unique = [...new Set(ids.filter(Number.isInteger))].slice(0, 100);
  if (unique.length === 0) return [];
  const rows = await db.all<MessageRow>(`${SELECT} WHERE conversation_id = ? AND id IN (${unique.map(() => "?").join(",")})`, [conversationId, ...unique]);
  return hydrate(db, me, rows);
}

async function rateLimited(db: Db, me: string, now: number): Promise<boolean> {
  const row = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM chat_messages WHERE author_id = ? AND created_at > ?", [me, now - 60_000]);
  return Number(row?.n ?? 0) >= MESSAGES_PER_MINUTE;
}

async function insertMessage(
  db: Db,
  me: string,
  conversationId: string,
  m: { kind: ChatKind; body: string; replyTo: number | null; clientId: string | null; mediaKey?: string; mediaType?: string; mediaMeta?: object },
  now: number,
): Promise<MessageView> {
  if (m.clientId) {
    // Idempotent: dieselbe Client-ID (z. B. nach Verbindungsabbruch erneut gesendet) liefert die vorhandene Nachricht.
    const dup = await db.get<MessageRow>(`${SELECT} WHERE author_id = ? AND client_id = ?`, [me, m.clientId]);
    if (dup) return (await hydrate(db, me, [dup]))[0];
  }
  let replyTo = m.replyTo;
  if (replyTo !== null) {
    const ok = await db.get("SELECT 1 AS ok FROM chat_messages WHERE id = ? AND conversation_id = ?", [replyTo, conversationId]);
    if (!ok) replyTo = null;
  }
  const row = await db.tx(async (t) => {
    await t.run(
      `INSERT INTO chat_messages (conversation_id, author_id, kind, body, reply_to, media_key, media_type, media_meta, created_at, client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [conversationId, me, m.kind, m.body, replyTo, m.mediaKey ?? null, m.mediaType ?? null, m.mediaMeta ? JSON.stringify(m.mediaMeta) : null, now, m.clientId],
    );
    const inserted = await t.get<MessageRow>(`${SELECT} WHERE conversation_id = ? AND author_id = ? ORDER BY id DESC LIMIT 1`, [conversationId, me]);
    await t.run("UPDATE conversations SET last_message_at = ? WHERE id = ?", [now, conversationId]);
    // Eigene Nachricht gilt als gelesen
    await t.run("UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id = ? AND last_read_id < ?", [
      inserted!.id,
      conversationId,
      me,
      inserted!.id,
    ]);
    return inserted!;
  });
  return (await hydrate(db, me, [row]))[0];
}

const cleanClientId = (v: unknown) => (typeof v === "string" && /^[\w-]{8,64}$/.test(v) ? v : null);

export async function sendText(
  db: Db,
  me: string,
  conversationId: string,
  input: { body?: unknown; replyTo?: unknown; clientId?: unknown },
  now: number,
): Promise<{ ok: true; message: MessageView } | Fail> {
  if (!(await isMember(db, conversationId, me))) return fail(404, "not found");
  const body = typeof input.body === "string" ? input.body.replace(/\r\n/g, "\n").trim() : "";
  if (!body) return fail(400, "empty message");
  if (body.length > MAX_TEXT) return fail(413, "message too long");
  if (await rateLimited(db, me, now)) return fail(429, "slow down");
  const replyTo = Number.isInteger(input.replyTo) ? (input.replyTo as number) : null;
  return { ok: true, message: await insertMessage(db, me, conversationId, { kind: "text", body, replyTo, clientId: cleanClientId(input.clientId) }, now) };
}

export async function sendMedia(
  db: Db,
  media: MediaStore,
  me: string,
  conversationId: string,
  input: { kind: "image" | "voice"; bytes: Uint8Array; caption: string; durationMs: number | null; width: number | null; height: number | null; replyTo: number | null; clientId: string | null },
  now: number,
): Promise<{ ok: true; message: MessageView } | Fail> {
  if (!(await isMember(db, conversationId, me))) return fail(404, "not found");
  if (await rateLimited(db, me, now)) return fail(429, "slow down");
  const limit = input.kind === "image" ? MAX_IMAGE_BYTES : MAX_VOICE_BYTES;
  if (input.bytes.length > limit) return fail(413, "file too large");
  if (input.bytes.length < 100) return fail(400, "file too small");
  const format = input.kind === "image" ? sniffImage(input.bytes) : sniffAudio(input.bytes);
  if (!format) return fail(415, "unsupported format");
  if (input.kind === "voice" && input.durationMs !== null && input.durationMs > MAX_VOICE_MS) return fail(400, "voice message too long");
  const key = `chat/${randomBytes(16).toString("hex")}.${format.ext}`;
  await media.put(key, input.bytes, format.contentType);
  const meta =
    input.kind === "image"
      ? { ...(input.width ? { width: input.width } : {}), ...(input.height ? { height: input.height } : {}) }
      : { ...(input.durationMs ? { durationMs: input.durationMs } : {}) };
  const message = await insertMessage(
    db,
    me,
    conversationId,
    {
      kind: input.kind,
      body: input.caption.trim().slice(0, 1000),
      replyTo: input.replyTo,
      clientId: input.clientId,
      mediaKey: key,
      mediaType: format.contentType,
      mediaMeta: meta,
    },
    now,
  );
  return { ok: true, message };
}

async function ownMessage(db: Db, me: string, id: number) {
  return db.get<MessageRow>(`${SELECT} WHERE id = ? AND author_id = ?`, [id, me]);
}

export async function editMessage(db: Db, me: string, id: number, body: unknown, now: number): Promise<{ ok: true; message: MessageView } | Fail> {
  const row = await ownMessage(db, me, id);
  if (!row || Number(row.deleted)) return fail(404, "not found");
  if (row.kind !== "text") return fail(400, "only text can be edited");
  if (now - Number(row.created_at) > EDIT_WINDOW_MS) return fail(409, "too late to edit");
  const text = typeof body === "string" ? body.trim() : "";
  if (!text || text.length > MAX_TEXT) return fail(400, "invalid message");
  await db.run("UPDATE chat_messages SET body = ?, edited_at = ? WHERE id = ?", [text, now, id]);
  return { ok: true, message: (await messagesByIds(db, me, row.conversation_id, [id]))![0] };
}

export async function deleteMessage(db: Db, media: MediaStore | null, me: string, id: number): Promise<{ ok: true; conversationId: string } | Fail> {
  const row = await ownMessage(db, me, id);
  if (!row) return fail(404, "not found");
  if (row.media_key && media) await media.delete(row.media_key).catch(() => undefined);
  await db.run("UPDATE chat_messages SET deleted = 1, body = '', media_key = NULL, correction = NULL WHERE id = ?", [id]);
  await db.run("DELETE FROM chat_reactions WHERE message_id = ?", [id]);
  return { ok: true, conversationId: row.conversation_id };
}

async function memberMessage(db: Db, me: string, id: number) {
  const row = await db.get<MessageRow>(`${SELECT} WHERE id = ?`, [id]);
  if (!row || Number(row.deleted) || !(await isMember(db, row.conversation_id, me))) return null;
  return row;
}

export async function toggleReaction(db: Db, me: string, id: number, emoji: unknown, now: number): Promise<{ ok: true; conversationId: string } | Fail> {
  if (typeof emoji !== "string" || !EMOJI.test(emoji)) return fail(400, "invalid emoji");
  const row = await memberMessage(db, me, id);
  if (!row) return fail(404, "not found");
  const existing = await db.get("SELECT 1 AS ok FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?", [id, me, emoji]);
  if (existing) await db.run("DELETE FROM chat_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?", [id, me, emoji]);
  else {
    const count = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM chat_reactions WHERE message_id = ? AND user_id = ?", [id, me]);
    if (Number(count?.n ?? 0) >= 6) return fail(429, "too many reactions");
    await db.run("INSERT INTO chat_reactions (message_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)", [id, me, emoji, now]);
  }
  return { ok: true, conversationId: row.conversation_id };
}

/** Korrekturvorschlag des Gegenübers (Sprachaustausch). Leerer Text entfernt die Korrektur. */
export async function correctMessage(db: Db, me: string, id: number, body: unknown): Promise<{ ok: true; conversationId: string } | Fail> {
  const row = await memberMessage(db, me, id);
  if (!row) return fail(404, "not found");
  if (row.author_id === me) return fail(400, "cannot correct your own message");
  if (row.kind !== "text") return fail(400, "only text can be corrected");
  const text = typeof body === "string" ? body.trim() : "";
  if (text.length > MAX_TEXT) return fail(413, "too long");
  if (text && text === row.body) return fail(400, "no change");
  await db.run("UPDATE chat_messages SET correction = ?, corrected_by = ? WHERE id = ?", [text || null, text ? me : null, id]);
  return { ok: true, conversationId: row.conversation_id };
}

export async function markRead(db: Db, me: string, conversationId: string, messageId: number): Promise<boolean> {
  if (!(await isMember(db, conversationId, me))) return false;
  await db.run("UPDATE conversation_members SET last_read_id = ? WHERE conversation_id = ? AND user_id = ? AND last_read_id < ?", [
    messageId,
    conversationId,
    me,
    messageId,
  ]);
  return true;
}

export async function chatMediaByFile(db: Db, file: string) {
  return db.get<{ media_key: string }>("SELECT media_key FROM chat_messages WHERE media_key = ? AND deleted = 0", [`chat/${file}`]);
}

// ---- Echtzeit: Ereignisse an verbundene Clients (Server-Sent Events) ------------------

export type ChatEvent =
  | { type: "message"; conversationId: string; messageId: number }
  | { type: "update"; conversationId: string; messageId: number }
  | { type: "read"; conversationId: string; userId: string; messageId: number }
  | { type: "conversation"; conversationId: string };

type Listener = (e: ChatEvent) => void;

/** Einfacher In-Process-Verteiler. Für mehrere Server-Instanzen später durch Postgres LISTEN/NOTIFY ersetzbar. */
export class ChatHub {
  private listeners = new Map<string, Set<Listener>>();
  subscribe(userId: string, fn: Listener): () => void {
    let set = this.listeners.get(userId);
    if (!set) this.listeners.set(userId, (set = new Set()));
    set.add(fn);
    return () => {
      set!.delete(fn);
      if (set!.size === 0) this.listeners.delete(userId);
    };
  }
  publish(userIds: string[], event: ChatEvent): void {
    for (const id of userIds) for (const fn of this.listeners.get(id) ?? []) fn(event);
  }
  get connections(): number {
    let n = 0;
    for (const s of this.listeners.values()) n += s.size;
    return n;
  }
}
