import { randomUUID } from "node:crypto";
import type { AuthResponse, CEFR_LEVELS, LangCode, UserProfile } from "@vochat/shared";
import type { Db } from "./db.js";

interface UserRow {
  id: string;
  email: string;
  name: string;
  native_lang: string;
}

export function loadProfile(db: Db, userId: string): UserProfile | null {
  const user = db.prepare("SELECT id, email, name, native_lang FROM users WHERE id = ?").get(userId) as
    | UserRow
    | undefined;
  if (!user) return null;
  const langs = db
    .prepare("SELECT lang, target_cefr FROM user_learn_langs WHERE user_id = ? ORDER BY lang")
    .all(userId) as { lang: LangCode; target_cefr: (typeof CEFR_LEVELS)[number] | null }[];
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    nativeLang: user.native_lang as LangCode,
    learnLangs: langs.map((l) => ({ lang: l.lang, targetCefr: l.target_cefr })),
  };
}

export function createUser(
  db: Db,
  input: { email: string; name: string; nativeLang: LangCode; passwordHash: string },
  now: number,
): string {
  const id = randomUUID();
  db.prepare("INSERT INTO users (id, email, name, password_hash, native_lang, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    id,
    input.email,
    input.name,
    input.passwordHash,
    input.nativeLang,
    now,
  );
  return id;
}

export function findUserByEmail(db: Db, email: string): { id: string; password_hash: string } | undefined {
  return db.prepare("SELECT id, password_hash FROM users WHERE email = ?").get(email) as
    | { id: string; password_hash: string }
    | undefined;
}

export function authResponse(token: string, profile: UserProfile): AuthResponse {
  return { token, user: profile };
}
