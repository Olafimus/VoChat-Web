import { isLangCode, type LangCode } from "@vochat/shared";
import { hashPassword, verifyPassword } from "./auth.js";
import { grantRole } from "./community.js";
import type { Db } from "./db/index.js";
import { createUser, findUserByEmail } from "./users.js";

export interface InitialAdminConfig {
  email: string;
  password?: string;
  name: string;
  nativeLang: LangCode;
  /** Passwort eines bestehenden Kontos auf ADMIN_PASSWORD setzen, Admin-Rolle sichern, Sperre aufheben. */
  resetPassword: boolean;
}

export function loadInitialAdmin(env: NodeJS.ProcessEnv = process.env): InitialAdminConfig | null {
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const lang = env.ADMIN_NATIVE_LANG ?? "de";
  return {
    email,
    password: env.ADMIN_PASSWORD || undefined,
    name: env.ADMIN_NAME?.trim() || "Admin",
    nativeLang: isLangCode(lang) ? lang : "de",
    resetPassword: env.ADMIN_PASSWORD_RESET === "1" || env.ADMIN_PASSWORD_RESET === "true",
  };
}

export type BootstrapResult = "disabled" | "created" | "reset" | "unchanged" | "exists" | "invalid";

/**
 * Admin-Konto aus Umgebungsvariablen beim Start.
 *
 * - Konto fehlt: wird mit ADMIN_PASSWORD angelegt und zum Admin ernannt.
 * - Konto existiert: bleibt unangetastet. Bewusst keine automatische Admin-Rolle – die E-Mail
 *   ist nicht verifiziert, jemand anderes könnte sich vorher mit dieser Adresse registriert haben.
 * - Mit ADMIN_PASSWORD_RESET=1: Passwort wird auf ADMIN_PASSWORD gesetzt (alle Sessions und
 *   offenen Reset-Links enden), die Admin-Rolle wird gesichert und eine Sperre aufgehoben.
 *   Danach übernimmt also, wer ADMIN_PASSWORD kennt – der Betreiber. Stimmt das Passwort
 *   schon, passiert nichts (ein vergessenes Flag beendet nicht bei jedem Neustart alle Sessions).
 */
export async function bootstrapAdmin(
  db: Db,
  config: InitialAdminConfig | null,
  now: number,
  log: (message: string) => void = console.log,
): Promise<BootstrapResult> {
  if (!config) return "disabled";
  const passwordOk = !!config.password && config.password.length >= 8 && config.password.length <= 200;
  const existing = await findUserByEmail(db, config.email);

  if (!existing) {
    if (!passwordOk) {
      log(`[admin] ADMIN_EMAIL=${config.email} gesetzt, aber ADMIN_PASSWORD fehlt oder ist kürzer als 8 Zeichen – kein Konto angelegt.`);
      return "invalid";
    }
    const id = await db.tx(async (t) => {
      const userId = await createUser(t, { email: config.email, name: config.name, nativeLang: config.nativeLang, passwordHash: await hashPassword(config.password!) }, now);
      await grantRole(t, userId, "admin", "", now);
      return userId;
    });
    log(`[admin] Admin-Konto ${config.email} angelegt (${id}).`);
    return "created";
  }

  if (!config.resetPassword) {
    const isAdmin = !!(await db.get("SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin'", [existing.id]));
    if (!isAdmin) {
      log(`[admin] ${config.email} ist bereits registriert, aber kein Admin. Zum Übernehmen einmalig ADMIN_PASSWORD_RESET=1 setzen.`);
    }
    return "exists";
  }
  if (!passwordOk) {
    log("[admin] ADMIN_PASSWORD_RESET gesetzt, aber ADMIN_PASSWORD fehlt oder ist kürzer als 8 Zeichen – nichts geändert.");
    return "invalid";
  }

  const samePassword = await verifyPassword(config.password!, existing.password_hash);
  const isAdmin = !!(await db.get("SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin'", [existing.id]));
  if (samePassword && isAdmin && existing.disabled_at === null) {
    log("[admin] ADMIN_PASSWORD_RESET ist noch gesetzt, Passwort stimmt bereits – bitte die Variable wieder entfernen.");
    return "unchanged";
  }

  await db.tx(async (t) => {
    if (!samePassword) {
      await t.run("UPDATE users SET password_hash = ? WHERE id = ?", [await hashPassword(config.password!), existing.id]);
      await t.run("DELETE FROM sessions WHERE user_id = ?", [existing.id]);
      await t.run("DELETE FROM password_resets WHERE user_id = ?", [existing.id]);
    }
    await t.run("UPDATE users SET disabled_at = NULL WHERE id = ?", [existing.id]);
    await grantRole(t, existing.id, "admin", "", now);
    await t.run(
      "INSERT INTO audit_log (actor_id, action, item_type, item_id, created_at) VALUES (NULL, 'admin.env_reset', 'user', ?, ?)",
      [existing.id, now],
    );
  });
  log(`[admin] Passwort von ${config.email} über ADMIN_PASSWORD_RESET zurückgesetzt, Admin-Rolle gesichert. Variable jetzt wieder entfernen.`);
  return "reset";
}
