import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";

const OPTS = { verifyThreshold: 2, rejectThreshold: 2, maxPendingPerUser: 5 };
let db: ReturnType<typeof openDb>;
let app: ReturnType<typeof createApp>;

const post = (path: string, body: unknown, token?: string, method = "POST") =>
  app.request(path, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
const get = (path: string, token?: string) => app.request(path, { headers: token ? { authorization: `Bearer ${token}` } : {} });

async function user(email: string, nativeLang = "de") {
  const res = await app.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "geheimes-passwort", name: email.split("@")[0], nativeLang }),
  });
  return (await res.json()) as { token: string; user: { id: string } };
}

beforeEach(() => {
  db = openDb(":memory:");
  db.exec("INSERT INTO lexemes (id, lang, lemma, pos, frequency_rank) VALUES (1, 'fa', 'آب', '', 1)");
  db.exec("INSERT INTO senses (lexeme_id, position, gloss_lang, gloss, source) VALUES (1, 0, 'de', 'Wasser', 'test')");
  app = createApp({ db, adminEmails: ["admin@example.com"], community: OPTS });
});

describe("community contributions", () => {
  it("lets a user suggest a meaning that is hidden until verified", async () => {
    const author = await user("author@example.com");
    const res = await post("/community/contributions", { payload: { kind: "sense", lexemeId: 1, glossLang: "de", gloss: "Flüssigkeit" } }, author.token);
    expect(res.status).toBe(201);
    const detail = await (await get("/dictionary/lexemes/1?native=de")).json();
    expect(detail.senses.map((s: { gloss: string }) => s.gloss)).toEqual(["Wasser"]);
  });

  it("verifies with enough community votes and applies the contribution", async () => {
    const author = await user("a1@example.com");
    const v1 = await user("v1@example.com");
    const v2 = await user("v2@example.com");
    const { id } = (await (await post("/community/contributions", { payload: { kind: "sense", lexemeId: 1, glossLang: "de", gloss: "Flüssigkeit" } }, author.token)).json());
    await post(`/community/contributions/${id}/vote`, { vote: "verify" }, v1.token);
    const second = await (await post(`/community/contributions/${id}/vote`, { vote: "verify" }, v2.token)).json();
    expect(second.status).toBe("verified");
    const detail = await (await get("/dictionary/lexemes/1?native=de")).json();
    const glosses = detail.senses.map((s: { gloss: string }) => s.gloss);
    expect(glosses).toContain("Flüssigkeit");
    expect(detail.senses.find((s: { gloss: string }) => s.gloss === "Flüssigkeit").source).toBe(`community:${id}`);
  });

  it("does not let authors vote on their own contribution", async () => {
    const author = await user("self@example.com");
    const { id } = await (await post("/community/contributions", { payload: { kind: "sense", lexemeId: 1, glossLang: "de", gloss: "x" } }, author.token)).json();
    const res = await post(`/community/contributions/${id}/vote`, { vote: "verify" }, author.token);
    expect(res.status).toBe(403);
  });

  it("lets a language expert decide alone, and only for their language", async () => {
    const admin = await user("admin@example.com");
    const expert = await user("experte@example.com");
    const other = await user("other@example.com");
    const author = await user("a3@example.com");
    const grant = await post("/admin/roles", { email: "experte@example.com", role: "expert", lang: "fa" }, admin.token);
    expect(grant.status).toBe(201);

    const { id } = await (await post("/community/contributions", { payload: { kind: "sense", lexemeId: 1, glossLang: "de", gloss: "Wasser (Trink-)" } }, author.token)).json();
    const denied = await post(`/community/contributions/${id}/decide`, { decision: "verify" }, other.token);
    expect(denied.status).toBe(403);
    const ok = await (await post(`/community/contributions/${id}/vote`, { vote: "verify" }, expert.token)).json();
    expect(ok.status).toBe("verified");
  });

  it("rejects with enough rejecting votes and never applies it", async () => {
    const author = await user("a4@example.com");
    const v1 = await user("r1@example.com");
    const v2 = await user("r2@example.com");
    const { id } = await (await post("/community/contributions", { payload: { kind: "sense", lexemeId: 1, glossLang: "de", gloss: "Unsinn" } }, author.token)).json();
    await post(`/community/contributions/${id}/vote`, { vote: "reject" }, v1.token);
    const res = await (await post(`/community/contributions/${id}/vote`, { vote: "reject" }, v2.token)).json();
    expect(res.status).toBe("rejected");
    const detail = await (await get("/dictionary/lexemes/1?native=de")).json();
    expect(detail.senses.map((s: { gloss: string }) => s.gloss)).not.toContain("Unsinn");
  });

  it("lets an expert retract a wrong sense, and an admin can revoke a verified contribution", async () => {
    const admin = await user("admin@example.com");
    await post("/admin/roles", { email: "admin@example.com", role: "expert", lang: "fa" }, admin.token);
    const author = await user("a5@example.com");
    const { id } = await (await post("/community/contributions", { payload: { kind: "sense", lexemeId: 1, glossLang: "de", gloss: "Quatsch" } }, author.token)).json();
    await post(`/community/contributions/${id}/decide`, { decision: "verify" }, admin.token);
    expect((await (await get("/dictionary/lexemes/1?native=de")).json()).senses.map((s: { gloss: string }) => s.gloss)).toContain("Quatsch");

    const senseRow = db.prepare("SELECT id FROM senses WHERE gloss = 'Wasser'").get() as { id: number };
    const retract = await post("/community/contributions", { payload: { kind: "retract", target: "sense", targetId: senseRow.id, reason: "falsche Bedeutung" } }, author.token);
    const rid = (await retract.json()).id;
    await post(`/community/contributions/${rid}/decide`, { decision: "verify" }, admin.token);
    expect((await (await get("/dictionary/lexemes/1?native=de")).json()).senses.map((s: { gloss: string }) => s.gloss)).not.toContain("Wasser");

    const revoke = await post(`/community/contributions/${id}/decide`, { decision: "revoke" }, admin.token);
    expect(revoke.status).toBe(200);
    expect((await (await get("/dictionary/lexemes/1?native=de")).json()).senses.map((s: { gloss: string }) => s.gloss)).not.toContain("Quatsch");
  });

  it("only admins can grant roles", async () => {
    const plain = await user("plain@example.com");
    const res = await post("/admin/roles", { email: "plain@example.com", role: "expert", lang: "fa" }, plain.token);
    expect(res.status).toBe(403);
  });

  it("gives configured admin emails the admin role on login", async () => {
    await user("admin@example.com");
    const row = db.prepare("SELECT r.role FROM user_roles r JOIN users u ON u.id = r.user_id WHERE u.email = 'admin@example.com'").get() as { role: string };
    expect(row.role).toBe("admin");
  });

  it("limits pending contributions per user", async () => {
    const author = await user("spam@example.com");
    for (let i = 0; i < 5; i++) {
      await post("/community/contributions", { payload: { kind: "sense", lexemeId: 1, glossLang: "de", gloss: `g${i}` } }, author.token);
    }
    const res = await post("/community/contributions", { payload: { kind: "sense", lexemeId: 1, glossLang: "de", gloss: "zu viel" } }, author.token);
    expect(res.status).toBe(429);
  });

  it("keeps public dictionary reads free of anonymous write access", async () => {
    const res = await post("/community/contributions", { payload: { kind: "sense", lexemeId: 1, glossLang: "de", gloss: "x" } });
    expect(res.status).toBe(401);
  });
});
