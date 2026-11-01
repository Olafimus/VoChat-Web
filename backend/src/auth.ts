import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Context, MiddlewareHandler } from "hono";
import type { Db } from "./db.js";

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

/** Erstellt eine Session und gibt den Klartext-Token zurück (nur die Hash-Summe wird gespeichert). */
export function createSession(db: Db, userId: string, now: number): string {
  const token = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    sha256(token),
    userId,
    now,
    now + SESSION_TTL_MS,
  );
  return token;
}

export function deleteSession(db: Db, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export function requireAuth(db: Db, now: () => number): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) return c.json({ error: "unauthorized" }, 401);
    const row = db
      .prepare("SELECT user_id, expires_at FROM sessions WHERE token_hash = ?")
      .get(sha256(token)) as { user_id: string; expires_at: number } | undefined;
    if (!row || row.expires_at < now()) return c.json({ error: "unauthorized" }, 401);
    c.set("userId", row.user_id);
    await next();
  };
}

export const currentUserId = (c: Context): string => c.get("userId" as never) as string;
