import { randomBytes } from "node:crypto";
import type { AudioRecording } from "@vochat/shared";
import type { Db } from "./db/index.js";
import type { MediaStore } from "./media.js";

/**
 * Eigene Sprachaufnahmen zu Wörterbucheinträgen. Der Browser nimmt höchstens 5 s komprimiert auf
 * (Opus, ~32 kbit/s ≈ 20 KB); der Server nimmt bis 256 KB an und prüft das Format anhand der Datei.
 * Aufnahmen von Experten/Admins sind sofort sichtbar, andere nach Freigabe durch einen Experten.
 */
export const MAX_RECORDING_BYTES = 256 * 1024;
export const MIN_RECORDING_BYTES = 800;
export const MAX_RECORDING_MS = 6_000;
export const RECORDINGS_PER_DAY = 40;

export function sniffAudio(b: Uint8Array): { ext: string; contentType: string } | null {
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  if (b.length < 12) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { ext: "webm", contentType: "audio/webm" };
  if (ascii(0, 4) === "OggS") return { ext: "ogg", contentType: "audio/ogg" };
  if (ascii(4, 4) === "ftyp") return { ext: "m4a", contentType: "audio/mp4" };
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WAVE") return { ext: "wav", contentType: "audio/wav" };
  if (ascii(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { ext: "mp3", contentType: "audio/mpeg" };
  return null;
}

type Row = {
  id: number;
  url: string;
  license: string | null;
  speaker: string | null;
  region: string | null;
  source: string;
  status: string;
  user_id: string | null;
};

const toRecording = (r: Row, viewer: string | null): AudioRecording => ({
  id: Number(r.id),
  url: r.url,
  license: r.license,
  speaker: r.speaker,
  region: r.region,
  source: r.source,
  status: r.status as AudioRecording["status"],
  mine: viewer !== null && r.user_id === viewer,
});

/** Aufnahmen eines Lexems: freigegebene für alle, dazu eigene ausstehende; Experten sehen alle nicht entfernten. */
export async function recordingsFor(db: Db, lexemeId: number, viewer: string | null, moderator = false): Promise<AudioRecording[]> {
  const rows = await db.all<Row>(
    `SELECT a.id, a.url, a.license, COALESCE(u.name, a.speaker) AS speaker, a.region, a.source, a.status, a.user_id
     FROM lexeme_audio a LEFT JOIN users u ON u.id = a.user_id
     WHERE a.lexeme_id = ? AND a.status <> 'hidden' AND (a.status = 'approved' OR a.user_id = ? OR ? = 1)
     ORDER BY CASE WHEN a.user_id IS NULL THEN 0 ELSE 1 END, a.id LIMIT 12`,
    [lexemeId, viewer ?? "", moderator ? 1 : 0],
  );
  return rows.map((r) => toRecording(r, viewer));
}

export type SaveResult =
  | { ok: true; recording: AudioRecording }
  | { ok: false; status: 400 | 404 | 413 | 415 | 429; error: string };

export async function saveRecording(
  db: Db,
  media: MediaStore,
  opts: { userId: string; lexemeId: number; bytes: Uint8Array; durationMs: number | null; autoApprove: boolean },
  now: number,
): Promise<SaveResult> {
  const { bytes } = opts;
  if (bytes.length > MAX_RECORDING_BYTES) return { ok: false, status: 413, error: "recording too large" };
  if (bytes.length < MIN_RECORDING_BYTES) return { ok: false, status: 400, error: "recording too short" };
  if (opts.durationMs !== null && opts.durationMs > MAX_RECORDING_MS) return { ok: false, status: 400, error: "recording too long" };
  const format = sniffAudio(bytes);
  if (!format) return { ok: false, status: 415, error: "unsupported audio format" };
  const lex = await db.get<{ id: number }>("SELECT id FROM lexemes WHERE id = ? AND hidden = 0", [opts.lexemeId]);
  if (!lex) return { ok: false, status: 404, error: "not found" };
  const recent = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM lexeme_audio WHERE user_id = ? AND created_at > ?", [
    opts.userId,
    now - 86_400_000,
  ]);
  if (Number(recent?.n ?? 0) >= RECORDINGS_PER_DAY) return { ok: false, status: 429, error: "daily limit reached" };

  // Je Person und Wort eine Aufnahme: die alte wird ersetzt.
  const previous = await db.all<{ id: number; media_key: string | null }>(
    "SELECT id, media_key FROM lexeme_audio WHERE lexeme_id = ? AND user_id = ?",
    [opts.lexemeId, opts.userId],
  );
  for (const p of previous) {
    if (p.media_key) await media.delete(p.media_key).catch(() => undefined);
    await db.run("DELETE FROM lexeme_audio WHERE id = ?", [p.id]);
  }

  const file = `${opts.lexemeId}-${randomBytes(12).toString("hex")}.${format.ext}`;
  const key = `recordings/${file}`;
  await media.put(key, bytes, format.contentType);
  const status = opts.autoApprove ? "approved" : "pending";
  await db.run(
    `INSERT INTO lexeme_audio (lexeme_id, url, source, license, speaker, region, created_at, user_id, status, media_key, duration_ms)
     VALUES (?, ?, 'user', 'CC BY-SA 4.0', NULL, NULL, ?, ?, ?, ?, ?)`,
    [opts.lexemeId, `/media/recordings/${file}`, now, opts.userId, status, key, opts.durationMs],
  );
  const row = await db.get<Row>(
    `SELECT a.id, a.url, a.license, u.name AS speaker, a.region, a.source, a.status, a.user_id
     FROM lexeme_audio a LEFT JOIN users u ON u.id = a.user_id WHERE a.media_key = ?`,
    [key],
  );
  return { ok: true, recording: toRecording(row!, opts.userId) };
}

export async function recordingByFile(db: Db, file: string) {
  return db.get<{ media_key: string; status: string }>("SELECT media_key, status FROM lexeme_audio WHERE media_key = ?", [`recordings/${file}`]);
}

export async function recordingOwner(db: Db, id: number) {
  return db.get<{ user_id: string | null; media_key: string | null; lexeme_id: number; lang: string }>(
    "SELECT a.user_id, a.media_key, a.lexeme_id, l.lang FROM lexeme_audio a JOIN lexemes l ON l.id = a.lexeme_id WHERE a.id = ?",
    [id],
  );
}

export async function deleteRecording(db: Db, media: MediaStore | null, id: number): Promise<void> {
  const row = await db.get<{ media_key: string | null }>("SELECT media_key FROM lexeme_audio WHERE id = ?", [id]);
  if (row?.media_key && media) await media.delete(row.media_key).catch(() => undefined);
  await db.run("DELETE FROM lexeme_audio WHERE id = ?", [id]);
}
