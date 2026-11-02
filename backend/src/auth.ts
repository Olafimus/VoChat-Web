import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Context, MiddlewareHandler } from "hono";
import type { Db } from "./db/index.js";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Erstellt eine Session und gibt den Klartext-Token zurück (gespeichert wird nur der Hash). */
export async function createSession(db: Db, userId: string, now: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.run("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [
    sha256(token),
    userId,
    now,
    now + SESSION_TTL_MS,
  ]);
  return token;
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.run("DELETE FROM sessions WHERE token_hash = ?", [sha256(token)]);
}

const bearer = (c: Context) => {
  const header = c.req.header("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
};

async function sessionUser(db: Db, token: string, now: number): Promise<string | null> {
  const row = await db.get<{ user_id: string; expires_at: number }>(
    // Gesperrte Konten verlieren sofort den Zugang, auch falls noch eine Session übrig wäre.
    "SELECT s.user_id, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND u.disabled_at IS NULL",
    [sha256(token)],
  );
  return row && row.expires_at >= now ? row.user_id : null;
}

export function requireAuth(db: Db, now: () => number): MiddlewareHandler {
  return async (c, next) => {
    const token = bearer(c);
    const userId = token ? await sessionUser(db, token, now()) : null;
    if (!userId) return c.json({ error: "unauthorized" }, 401);
    c.set("userId" as never, userId as never);
    await next();
  };
}

/**
 * Optionale Anmeldung: Öffentliche Endpunkte (Wörterbuch, Katalog) funktionieren ohne Konto.
 * Ist ein gültiger Token mitgeschickt, steht die Nutzer-ID bereit.
 */
export function optionalAuth(db: Db, now: () => number): MiddlewareHandler {
  return async (c, next) => {
    const token = bearer(c);
    if (token) {
      const userId = await sessionUser(db, token, now());
      if (userId) c.set("userId" as never, userId as never);
    }
    await next();
  };
}

export const currentUserId = (c: Context): string => c.get("userId" as never) as string;
export const maybeUserId = (c: Context): string | undefined => c.get("userId" as never) as string | undefined;

// ---- Passwort zurücksetzen ------------------------------------------------

export const RESET_TTL_MS = 60 * 60 * 1000;

/** Einmal-Link zum Zurücksetzen. Ältere offene Links desselben Kontos werden ungültig. */
export async function createPasswordReset(db: Db, userId: string, now: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await db.tx(async (t) => {
    await t.run("DELETE FROM password_resets WHERE user_id = ?", [userId]);
    await t.run("INSERT INTO password_resets (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)", [
      sha256(token),
      userId,
      now,
      now + RESET_TTL_MS,
    ]);
  });
  return token;
}

/** Löst einen Link ein: setzt das Passwort und beendet alle Sessions. Liefert die Nutzer-ID oder null. */
export async function consumePasswordReset(db: Db, token: string, passwordHash: string, now: number): Promise<string | null> {
  return db.tx(async (t) => {
    const row = await t.get<{ user_id: string }>(
      `SELECT r.user_id FROM password_resets r JOIN users u ON u.id = r.user_id
       WHERE r.token_hash = ? AND r.used_at IS NULL AND r.expires_at >= ? AND u.disabled_at IS NULL`,
      [sha256(token), now],
    );
    if (!row) return null;
    const claimed = await t.run("UPDATE password_resets SET used_at = ? WHERE token_hash = ? AND used_at IS NULL", [now, sha256(token)]);
    if (claimed.changes === 0) return null;
    await t.run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, row.user_id]);
    await t.run("DELETE FROM sessions WHERE user_id = ?", [row.user_id]);
    await t.run("DELETE FROM password_resets WHERE user_id = ? AND token_hash <> ?", [row.user_id, sha256(token)]);
    return row.user_id;
  });
}
