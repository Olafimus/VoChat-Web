import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { bootstrapAdmin, loadInitialAdmin } from "../src/bootstrap.js";
import type { Db } from "../src/db/index.js";
import { testDb } from "./helpers.js";

let db: Db;
let app: ReturnType<typeof createApp>;
const logs: string[] = [];
const log = (m: string) => logs.push(m);

const login = (email: string, password: string) =>
  app.request("/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
const me = async (token: string) => app.request("/me", { headers: { authorization: `Bearer ${token}` } });
const env = (vars: Record<string, string>) => loadInitialAdmin(vars);

beforeEach(async () => {
  db = await testDb();
  app = createApp({ db });
  logs.length = 0;
});

describe("initial admin from environment", () => {
  it("does nothing without ADMIN_EMAIL", async () => {
    expect(loadInitialAdmin({})).toBeNull();
    expect(await bootstrapAdmin(db, env({}), Date.now(), log)).toBe("disabled");
  });

  it("creates the admin account once and leaves it alone afterwards", async () => {
    const cfg = env({ ADMIN_EMAIL: " Boss@Example.com ", ADMIN_PASSWORD: "start-passwort", ADMIN_NAME: "Chefin", ADMIN_NATIVE_LANG: "fa" });
    expect(await bootstrapAdmin(db, cfg, Date.now(), log)).toBe("created");
    const res = await login("boss@example.com", "start-passwort");
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user).toMatchObject({ name: "Chefin", nativeLang: "fa", roles: [{ role: "admin", lang: "" }] });

    // Zweiter Start mit anderem Passwort ohne Reset-Flag: nichts ändert sich
    expect(await bootstrapAdmin(db, env({ ADMIN_EMAIL: "boss@example.com", ADMIN_PASSWORD: "anderes-passwort" }), Date.now(), log)).toBe("exists");
    expect((await login("boss@example.com", "start-passwort")).status).toBe(200);
  });

  it("refuses to create an account without a usable password", async () => {
    expect(await bootstrapAdmin(db, env({ ADMIN_EMAIL: "a@example.com" }), Date.now(), log)).toBe("invalid");
    expect(await bootstrapAdmin(db, env({ ADMIN_EMAIL: "a@example.com", ADMIN_PASSWORD: "kurz" }), Date.now(), log)).toBe("invalid");
    expect(await db.get("SELECT id FROM users")).toBeUndefined();
    expect(logs.join("\n")).not.toContain("kurz");
  });

  it("never promotes an account someone else registered unless the password is reset", async () => {
    await app.request("/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "boss@example.com", password: "fremdes-passwort", name: "Fremd", nativeLang: "de" }),
    });
    expect(await bootstrapAdmin(db, env({ ADMIN_EMAIL: "boss@example.com", ADMIN_PASSWORD: "start-passwort" }), Date.now(), log)).toBe("exists");
    expect(logs.at(-1)).toContain("ADMIN_PASSWORD_RESET");
    const { user } = await (await login("boss@example.com", "fremdes-passwort")).json();
    expect(user.roles).toEqual([]);
  });

  it("resets the password, ends sessions, restores the admin role and lifts a ban", async () => {
    await bootstrapAdmin(db, env({ ADMIN_EMAIL: "boss@example.com", ADMIN_PASSWORD: "start-passwort" }), Date.now(), log);
    const { token, user } = await (await login("boss@example.com", "start-passwort")).json();
    await db.run("DELETE FROM user_roles WHERE user_id = ?", [user.id]);
    await db.run("UPDATE users SET disabled_at = 1 WHERE id = ?", [user.id]);

    const reset = env({ ADMIN_EMAIL: "boss@example.com", ADMIN_PASSWORD: "neues-passwort", ADMIN_PASSWORD_RESET: "1" });
    expect(await bootstrapAdmin(db, reset, Date.now(), log)).toBe("reset");
    expect((await me(token)).status).toBe(401);
    expect((await login("boss@example.com", "start-passwort")).status).toBe(401);
    const fresh = await login("boss@example.com", "neues-passwort");
    expect(fresh.status).toBe(200);
    const body = await fresh.json();
    expect(body.user.roles).toEqual([{ role: "admin", lang: "" }]);
    const audit = await db.get<{ action: string }>("SELECT action FROM audit_log WHERE item_id = ?", [user.id]);
    expect(audit?.action).toBe("admin.env_reset");

    // Flag vergessen: nächster Start lässt Sessions in Ruhe
    expect(await bootstrapAdmin(db, reset, Date.now(), log)).toBe("unchanged");
    expect((await me(body.token)).status).toBe(200);
  });

  it("ignores a reset request without a valid password", async () => {
    await bootstrapAdmin(db, env({ ADMIN_EMAIL: "boss@example.com", ADMIN_PASSWORD: "start-passwort" }), Date.now(), log);
    expect(await bootstrapAdmin(db, env({ ADMIN_EMAIL: "boss@example.com", ADMIN_PASSWORD_RESET: "true" }), Date.now(), log)).toBe("invalid");
    expect((await login("boss@example.com", "start-passwort")).status).toBe(200);
  });
});
