import type { LangCode } from "@vochat/shared";
import type { Db } from "./db/index.js";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  nativeLang: LangCode;
  createdAt: number;
  disabledAt: number | null;
  /** Letzte Anmeldung (jüngste Session), null wenn keine aktive Session besteht. */
  lastLoginAt: number | null;
  roles: { role: string; lang: string }[];
}

export type UserFilter = "" | "admin" | "expert" | "disabled";

interface Row {
  id: string;
  email: string;
  name: string;
  native_lang: string;
  created_at: number;
  disabled_at: number | null;
  last_login: number | null;
}

const likePattern = (q: string) => `%${q.toLowerCase().replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

/** Nutzerliste für die Admin-Seite: Suche nach Name/E-Mail, Filter nach Rolle oder Sperre. */
export async function listUsers(
  db: Db,
  o: { q?: string; filter?: UserFilter; limit?: number; offset?: number },
): Promise<{ total: number; users: AdminUser[] }> {
  const q = (o.q ?? "").trim().slice(0, 100);
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q) {
    where.push("(LOWER(u.email) LIKE ? ESCAPE '\\' OR LOWER(u.name) LIKE ? ESCAPE '\\')");
    params.push(likePattern(q), likePattern(q));
  }
  if (o.filter === "admin" || o.filter === "expert") {
    where.push("EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = ?)");
    params.push(o.filter);
  } else if (o.filter === "disabled") {
    where.push("u.disabled_at IS NOT NULL");
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM users u ${clause}`, params);
  const rows = await db.all<Row>(
    `SELECT u.id, u.email, u.name, u.native_lang, u.created_at, u.disabled_at,
            (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_login
     FROM users u ${clause}
     ORDER BY u.created_at DESC, u.id
     LIMIT ? OFFSET ?`,
    [...params, Math.min(100, Math.max(1, o.limit ?? 25)), Math.max(0, o.offset ?? 0)],
  );
  return { total: Number(total?.n ?? 0), users: await withRoles(db, rows) };
}

export async function adminUser(db: Db, id: string): Promise<AdminUser | null> {
  const row = await db.get<Row>(
    `SELECT u.id, u.email, u.name, u.native_lang, u.created_at, u.disabled_at,
            (SELECT MAX(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_login
     FROM users u WHERE u.id = ?`,
    [id],
  );
  return row ? (await withRoles(db, [row]))[0]! : null;
}

async function withRoles(db: Db, rows: Row[]): Promise<AdminUser[]> {
  const byUser = new Map<string, { role: string; lang: string }[]>();
  if (rows.length) {
    const roles = await db.all<{ user_id: string; role: string; lang: string }>(
      `SELECT user_id, role, lang FROM user_roles WHERE user_id IN (${rows.map(() => "?").join(", ")}) ORDER BY role, lang`,
      rows.map((r) => r.id),
    );
    for (const r of roles) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), { role: r.role, lang: r.lang }]);
  }
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    nativeLang: r.native_lang as LangCode,
    createdAt: Number(r.created_at),
    disabledAt: r.disabled_at === null ? null : Number(r.disabled_at),
    lastLoginAt: r.last_login === null ? null : Number(r.last_login),
    roles: byUser.get(r.id) ?? [],
  }));
}

/** Anzahl aktiver (nicht gesperrter) Admins – der letzte darf nicht entfernt werden. */
export async function activeAdminCount(db: Db): Promise<number> {
  const row = await db.get<{ n: number }>(
    `SELECT COUNT(DISTINCT r.user_id) AS n FROM user_roles r JOIN users u ON u.id = r.user_id
     WHERE r.role = 'admin' AND u.disabled_at IS NULL`,
  );
  return Number(row?.n ?? 0);
}

/** Sperrt oder entsperrt ein Konto. Beim Sperren enden alle Sessions sofort. */
export async function setDisabled(db: Db, userId: string, disabled: boolean, now: number): Promise<boolean> {
  return db.tx(async (t) => {
    const res = await t.run("UPDATE users SET disabled_at = ? WHERE id = ?", [disabled ? now : null, userId]);
    if (disabled) {
      await t.run("DELETE FROM sessions WHERE user_id = ?", [userId]);
      await t.run("DELETE FROM password_resets WHERE user_id = ?", [userId]);
    }
    return res.changes > 0;
  });
}

export async function deleteUser(db: Db, userId: string): Promise<boolean> {
  return (await db.run("DELETE FROM users WHERE id = ?", [userId])).changes > 0;
}

export async function adminStats(db: Db, now: number) {
  const n = async (sql: string, params: (string | number)[] = []) => Number((await db.get<{ n: number }>(sql, params))?.n ?? 0);
  const experts = await db.all<{ lang: string; n: number }>(
    "SELECT lang, COUNT(*) AS n FROM user_roles WHERE role = 'expert' GROUP BY lang ORDER BY lang",
  );
  return {
    users: await n("SELECT COUNT(*) AS n FROM users"),
    newLast7Days: await n("SELECT COUNT(*) AS n FROM users WHERE created_at >= ?", [now - 7 * 24 * 60 * 60 * 1000]),
    disabled: await n("SELECT COUNT(*) AS n FROM users WHERE disabled_at IS NOT NULL"),
    admins: await n("SELECT COUNT(*) AS n FROM user_roles WHERE role = 'admin'"),
    experts: Object.fromEntries(experts.map((e) => [e.lang, Number(e.n)])) as Record<string, number>,
  };
}
