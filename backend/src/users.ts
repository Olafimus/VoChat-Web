import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { AuthResponse, CEFR_LEVELS, LangCode, UserProfile } from "@vochat/shared";
import type { Db } from "./db/index.js";

interface UserRow {
  id: string;
  email: string;
  name: string;
  native_lang: string;
  bio: string;
  avatar_ext: string | null;
  avatar_version: number;
  profile_public: number;
  show_progress: number;
}

/**
 * Avatar-Links sind signiert (HMAC über Nutzer-ID und Version). So können Browser Avatare
 * privater Profile per <img> laden, ohne Token-Header – sichtbar für alle, denen die API den
 * Link herausgibt. Der Schlüssel kommt aus APP_SECRET oder wird dauerhaft in der DB abgelegt.
 */
let avatarSecret: Buffer = randomBytes(32);
export const setAvatarSecret = (secret: string) => {
  avatarSecret = Buffer.from(secret);
};
const sign = (id: string, version: number) => createHmac("sha256", avatarSecret).update(`${id}:${version}`).digest("base64url").slice(0, 22);

export function verifyAvatarSignature(id: string, version: number, signature: string): boolean {
  const expected = Buffer.from(sign(id, version));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export const avatarUrl = (row: { id: string; avatar_ext: string | null; avatar_version: number }): string | null =>
  row.avatar_ext ? `/media/avatars/${row.id}?v=${row.avatar_version}&s=${sign(row.id, Number(row.avatar_version))}` : null;

export async function loadProfile(db: Db, userId: string): Promise<UserProfile | null> {
  const user = await db.get<UserRow>(
    `SELECT id, email, name, native_lang, bio, avatar_ext, avatar_version, profile_public, show_progress
     FROM users WHERE id = ?`,
    [userId],
  );
  if (!user) return null;
  const langs = await db.all<{ lang: LangCode; target_cefr: (typeof CEFR_LEVELS)[number] | null }>(
    "SELECT lang, target_cefr FROM user_learn_langs WHERE user_id = ? ORDER BY lang",
    [userId],
  );
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    bio: user.bio,
    avatarUrl: avatarUrl(user),
    nativeLang: user.native_lang as LangCode,
    learnLangs: langs.map((l) => ({ lang: l.lang, targetCefr: l.target_cefr })),
    profilePublic: Number(user.profile_public) === 1,
    showProgress: Number(user.show_progress) === 1,
  };
}

export async function createUser(
  db: Db,
  input: { email: string; name: string; nativeLang: LangCode; passwordHash: string },
  now: number,
): Promise<string> {
  const id = randomUUID();
  await db.run("INSERT INTO users (id, email, name, password_hash, native_lang, created_at) VALUES (?, ?, ?, ?, ?, ?)", [
    id,
    input.email,
    input.name,
    input.passwordHash,
    input.nativeLang,
    now,
  ]);
  return id;
}

export function findUserByEmail(db: Db, email: string) {
  return db.get<{ id: string; password_hash: string }>("SELECT id, password_hash FROM users WHERE email = ?", [email]);
}

export function authResponse(token: string, profile: UserProfile): AuthResponse {
  return { token, user: profile };
}
