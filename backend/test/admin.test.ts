import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { grantRole } from "../src/community.js";
import type { Db } from "../src/db/index.js";
import { createMailAdapter, loadMailConfig, MailService, MemoryMailAdapter, registerMailDriver } from "../src/mail/index.js";
import { testDb } from "./helpers.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let outbox: MemoryMailAdapter;
let mail: MailService;

const req = (path: string, init: { method?: string; body?: unknown; token?: string } = {}) =>
  app.request(path, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: {
      ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });

async function user(email: string, password = "geheimes-passwort") {
  const res = await req("/auth/register", { body: { email, password, name: email.split("@")[0], nativeLang: "de" } });
  return (await res.json()) as { token: string; user: { id: string; roles: { role: string }[] } };
}

async function admin(email = "admin@example.com") {
  const u = await user(email);
  await grantRole(db, u.user.id, "admin", "", Date.now());
  return u;
}

const lastMailTo = (to: string) => [...outbox.sent].reverse().find((m) => m.to === to);
const tokenFrom = (text: string) => decodeURIComponent(/token=([^\s&]+)/.exec(text)![1]!);

beforeEach(async () => {
  db = await testDb();
  outbox = new MemoryMailAdapter();
  mail = new MailService(outbox, { from: "VoChat <noreply@test>", publicUrl: "https://vochat.test/" });
  app = createApp({ db, mail });
});

describe("admin access", () => {
  it("rejects anonymous and non-admin users", async () => {
    const u = await user("u@example.com");
    expect((await req("/admin/users")).status).toBe(401);
    expect((await req("/admin/users", { token: u.token })).status).toBe(403);
    expect((await req("/admin/stats", { token: u.token })).status).toBe(403);
  });

  it("exposes roles in the own profile", async () => {
    const a = await admin();
    const me = await (await req("/me", { token: a.token })).json();
    expect(me.roles).toEqual([{ role: "admin", lang: "" }]);
  });
});

describe("user management", () => {
  it("lists, searches and filters users", async () => {
    const a = await admin();
    await user("anna@example.com");
    const bob = await user("bob@example.com");
    await grantRole(db, bob.user.id, "expert", "fa", Date.now());

    const all = await (await req("/admin/users", { token: a.token })).json();
    expect(all.total).toBe(3);
    expect(all.users[0].lastLoginAt).toEqual(expect.any(Number));

    const search = await (await req("/admin/users?q=ANN", { token: a.token })).json();
    expect(search.users.map((u: { email: string }) => u.email)).toEqual(["anna@example.com"]);

    const experts = await (await req("/admin/users?filter=expert", { token: a.token })).json();
    expect(experts.users.map((u: { email: string }) => u.email)).toEqual(["bob@example.com"]);
    expect(experts.users[0].roles).toEqual([{ role: "expert", lang: "fa" }]);

    // LIKE-Platzhalter werden wörtlich gesucht
    const wildcard = await (await req("/admin/users?q=%25", { token: a.token })).json();
    expect(wildcard.total).toBe(0);

    const stats = await (await req("/admin/stats", { token: a.token })).json();
    expect(stats).toMatchObject({ users: 3, admins: 1, experts: { fa: 1 }, mail: { enabled: true, driver: "memory" } });
  });

  it("grants and revokes roles by user id and notifies by mail", async () => {
    const a = await admin();
    const u = await user("expert@example.com");
    await mail.idle();
    outbox.sent.length = 0;

    expect((await req(`/admin/users/${u.user.id}/roles`, { token: a.token, body: { role: "expert" } })).status).toBe(400);
    const granted = await req(`/admin/users/${u.user.id}/roles`, { token: a.token, body: { role: "expert", lang: "fa" } });
    expect(granted.status).toBe(201);
    expect((await granted.json()).roles).toEqual([{ role: "expert", lang: "fa" }]);
    await mail.idle();
    expect(lastMailTo("expert@example.com")?.subject).toContain("Experte für");

    // Gleiche Rolle erneut: keine zweite Mail
    await req(`/admin/users/${u.user.id}/roles`, { token: a.token, body: { role: "expert", lang: "fa" } });
    await mail.idle();
    expect(outbox.sent).toHaveLength(1);

    const revoked = await req(`/admin/users/${u.user.id}/roles`, { token: a.token, method: "DELETE", body: { role: "expert", lang: "fa" } });
    expect((await revoked.json()).roles).toEqual([]);
    await mail.idle();
    expect(lastMailTo("expert@example.com")?.subject).toContain("Rolle entzogen");

    const log = await db.all<{ action: string }>("SELECT action FROM audit_log WHERE item_id = ? ORDER BY id", [u.user.id]);
    expect(log.map((l) => l.action)).toEqual(["admin.role_grant", "admin.role_revoke"]);
  });

  it("keeps the legacy grant-by-email endpoint working", async () => {
    const a = await admin();
    await user("legacy@example.com");
    const res = await req("/admin/roles", { token: a.token, body: { email: "Legacy@example.com", role: "expert", lang: "ja" } });
    expect(res.status).toBe(201);
    expect((await res.json()).roles).toEqual([{ role: "expert", lang: "ja" }]);
  });

  it("never removes the last active admin", async () => {
    const a = await admin();
    expect((await req(`/admin/users/${a.user.id}/roles`, { token: a.token, method: "DELETE", body: { role: "admin" } })).status).toBe(409);
    const b = await admin("second@example.com");
    expect((await req(`/admin/users/${a.user.id}/roles`, { token: b.token, method: "DELETE", body: { role: "admin" } })).status).toBe(200);
    expect((await req(`/admin/users/${b.user.id}`, { token: b.token, method: "DELETE" })).status).toBe(409); // sich selbst
  });

  it("disables accounts: sessions end, login is refused, enabling restores access", async () => {
    const a = await admin();
    const u = await user("bad@example.com");
    expect((await req(`/admin/users/${a.user.id}`, { token: a.token, method: "PATCH", body: { disabled: true } })).status).toBe(409);

    const res = await req(`/admin/users/${u.user.id}`, { token: a.token, method: "PATCH", body: { disabled: true } });
    expect((await res.json()).disabledAt).toEqual(expect.any(Number));
    expect((await req("/me", { token: u.token })).status).toBe(401);
    const login = await req("/auth/login", { body: { email: "bad@example.com", password: "geheimes-passwort" } });
    expect(login.status).toBe(403);
    await mail.idle();
    expect(lastMailTo("bad@example.com")?.subject).toContain("gesperrt");

    const disabled = await (await req("/admin/users?filter=disabled", { token: a.token })).json();
    expect(disabled.total).toBe(1);

    await req(`/admin/users/${u.user.id}`, { token: a.token, method: "PATCH", body: { disabled: false, name: "Neu" } });
    const again = await req("/auth/login", { body: { email: "bad@example.com", password: "geheimes-passwort" } });
    expect(again.status).toBe(200);
    expect((await again.json()).user.name).toBe("Neu");
  });

  it("deletes accounts", async () => {
    const a = await admin();
    const u = await user("gone@example.com");
    expect((await req(`/admin/users/${u.user.id}`, { token: a.token, method: "DELETE" })).status).toBe(200);
    expect((await req(`/admin/users/${u.user.id}`, { token: a.token })).status).toBe(404);
    expect((await req("/me", { token: u.token })).status).toBe(401);
  });
});

describe("password reset by mail", () => {
  it("sends a single-use link that sets a new password and ends all sessions", async () => {
    const u = await user("forgot@example.com");
    await mail.idle();
    expect(lastMailTo("forgot@example.com")?.subject).toContain("Willkommen");

    expect((await req("/auth/password/forgot", { body: { email: "FORGOT@example.com" } })).status).toBe(200);
    await mail.idle();
    const message = lastMailTo("forgot@example.com")!;
    expect(message.subject).toBe("Passwort zurücksetzen");
    expect(message.from).toBe("VoChat <noreply@test>");
    expect(message.text).toContain("https://vochat.test/reset-password?token=");
    expect(message.html).toContain("Neues Passwort festlegen");
    const token = tokenFrom(message.text);

    expect((await req("/auth/password/reset", { body: { token, password: "kurz" } })).status).toBe(400);
    expect((await req("/auth/password/reset", { body: { token, password: "neues-passwort-123" } })).status).toBe(200);
    expect((await req("/auth/password/reset", { body: { token, password: "noch-ein-passwort" } })).status).toBe(400);

    expect((await req("/me", { token: u.token })).status).toBe(401);
    expect((await req("/auth/login", { body: { email: "forgot@example.com", password: "geheimes-passwort" } })).status).toBe(401);
    expect((await req("/auth/login", { body: { email: "forgot@example.com", password: "neues-passwort-123" } })).status).toBe(200);
  });

  it("answers the same for unknown addresses and invalidates older links", async () => {
    await user("x@example.com");
    await mail.idle();
    outbox.sent.length = 0;
    expect((await req("/auth/password/forgot", { body: { email: "nobody@example.com" } })).status).toBe(200);
    await mail.idle();
    expect(outbox.sent).toHaveLength(0);

    await req("/auth/password/forgot", { body: { email: "x@example.com" } });
    await mail.idle();
    const first = tokenFrom(outbox.sent[0]!.text);
    await req("/auth/password/forgot", { body: { email: "x@example.com" } });
    await mail.idle();
    const second = tokenFrom(outbox.sent[1]!.text);
    expect((await req("/auth/password/reset", { body: { token: first, password: "neues-passwort-123" } })).status).toBe(400);
    expect((await req("/auth/password/reset", { body: { token: second, password: "neues-passwort-123" } })).status).toBe(200);
  });

  it("lets admins send the reset link", async () => {
    const a = await admin();
    const u = await user("help@example.com");
    expect((await req(`/admin/users/${u.user.id}/password-reset`, { token: a.token, body: {} })).status).toBe(200);
    expect(lastMailTo("help@example.com")?.subject).toBe("Passwort zurücksetzen");
  });

  it("is unavailable without a mail adapter", async () => {
    app = createApp({ db });
    await user("nomail@example.com");
    expect((await req("/auth/password/forgot", { body: { email: "nomail@example.com" } })).status).toBe(503);
    expect((await (await req("/features")).json()).mail).toBe(false);
  });
});

describe("mail service", () => {
  it("sends a test mail and reports adapter failures", async () => {
    const a = await admin();
    expect((await req("/admin/mail/test", { token: a.token, body: { to: "ops@example.com" } })).status).toBe(200);
    expect(lastMailTo("ops@example.com")?.subject).toContain("Testmail");
    outbox.failNext = true;
    const failed = await req("/admin/mail/test", { token: a.token, body: { to: "ops@example.com" } });
    expect(failed.status).toBe(502);
    expect((await req("/admin/mail/verify", { token: a.token, body: {} })).status).toBe(200);
  });

  it("escapes user content in HTML mails", () => {
    const m = mail.welcome("a@example.com", "<script>x</script>");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("builds adapters from configuration and accepts custom drivers", async () => {
    expect(await createMailAdapter(loadMailConfig({}))).toBeNull();
    expect((await createMailAdapter(loadMailConfig({ MAIL_DRIVER: "console" })))?.name).toBe("console");
    const smtp = await createMailAdapter(loadMailConfig({ MAIL_DRIVER: "smtp", SMTP_HOST: "localhost", SMTP_PORT: "2525" }));
    expect(smtp?.name).toBe("smtp");
    smtp?.close?.();
    const gmail = await createMailAdapter(loadMailConfig({ MAIL_DRIVER: "gmail", GMAIL_USER: "me@gmail.com", GMAIL_APP_PASSWORD: "x" }));
    expect(gmail?.name).toBe("gmail");
    gmail?.close?.();
    await expect(createMailAdapter(loadMailConfig({ MAIL_DRIVER: "smtp" }))).rejects.toThrow(/SMTP_HOST/);
    await expect(createMailAdapter(loadMailConfig({ MAIL_DRIVER: "gmail", GMAIL_USER: "me@gmail.com" }))).rejects.toThrow(/GMAIL_APP_PASSWORD/);
    await expect(createMailAdapter(loadMailConfig({ MAIL_DRIVER: "pigeon" }))).rejects.toThrow(/unbekannt/);

    registerMailDriver("pigeon", async () => new MemoryMailAdapter());
    expect((await createMailAdapter(loadMailConfig({ MAIL_DRIVER: "pigeon" })))?.name).toBe("memory");
    expect(loadMailConfig({ GMAIL_USER: "me@gmail.com" }).from).toBe("VoChat <me@gmail.com>");
    expect(loadMailConfig({ SMTP_PORT: "465" }).smtp.secure).toBe(true);
  });
});
