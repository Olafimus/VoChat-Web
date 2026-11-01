/**
 * Rollen vergeben oder entziehen – nur über die Kommandozeile des Betreibers.
 * (Bewusst nicht über E-Mail-Listen beim Login: E-Mail-Adressen werden nicht verifiziert,
 * sonst könnte sich jemand mit einer Admin-Adresse registrieren und die Rolle übernehmen.)
 *
 *   npm run admin:grant -w backend -- --email ich@example.com --role admin
 *   npm run admin:grant -w backend -- --email experte@example.com --role expert --lang fa
 *   npm run admin:grant -w backend -- --email experte@example.com --role expert --lang fa --revoke
 */
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isLangCode } from "@vochat/shared";
import { openDatabase } from "../src/db/index.js";
import { grantRole, revokeRole, rolesOf } from "../src/community.js";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const email = flag("email")?.trim().toLowerCase();
const role = flag("role");
const lang = flag("lang") ?? "";
const revoke = args.includes("--revoke");

if (!email || (role !== "admin" && role !== "expert") || (role === "expert" && !isLangCode(lang))) {
  console.error("Aufruf: --email <adresse> --role admin|expert [--lang de|en|es|fa|ja] [--revoke]");
  process.exit(1);
}

const backendDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.DATABASE_URL ?? process.env.DB_PATH ?? "data/vochat.db";
const db = await openDatabase(/^(postgres|pglite:)/.test(target) ? target : resolve(backendDir, target));
const user = await db.get<{ id: string }>("SELECT id FROM users WHERE email = ?", [email]);
if (!user) {
  console.error(`Kein Konto mit der E-Mail ${email}. Die Person muss sich zuerst registrieren.`);
  await db.close();
  process.exit(1);
}
if (revoke) await revokeRole(db, user.id, role, lang);
else await grantRole(db, user.id, role, lang, Date.now());
console.log(`Rollen von ${email}:`, (await rolesOf(db, user.id)).map((r) => (r.lang ? `${r.role}:${r.lang}` : r.role)).join(", ") || "keine");
await db.close();
