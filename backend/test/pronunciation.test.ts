import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db/index.js";
import { addGloss, addLexeme, testDb } from "./helpers.js";

let db: Db;
let app: ReturnType<typeof createApp>;

const json = (body: unknown, token?: string) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

async function user(email: string) {
  const r = await app.request("/auth/register", json({ email, password: "geheimes-passwort", name: email.split("@")[0], nativeLang: "de" }));
  return (await r.json()) as { token: string; user: { id: string } };
}

beforeEach(async () => {
  db = await testDb();
  await addLexeme(db, { id: 1, lang: "fa", lemma: "آب", rank: 1, romanization: "āb" });
  await addLexeme(db, { id: 2, lang: "fa", lemma: "کتاب", rank: 2 });
  app = createApp({ db, community: { verifyThreshold: 1, rejectThreshold: 1, maxPendingPerUser: 5 } });
});

describe("pronunciation", () => {
  it("returns romanization in search results and details", async () => {
    const res = await (await app.request("/dictionary/search?lang=fa&q=آ&native=de")).json();
    expect(res.find((r: { id: number }) => r.id === 1).romanization).toBe("āb");
    const detail = await (await app.request("/dictionary/lexemes/2?native=de")).json();
    expect(detail.romanization).toBeNull();
  });

  it("lets a user add a missing pronunciation through a verified contribution", async () => {
    const author = await user("pron-a@example.com");
    const voter = await user("pron-v@example.com");
    const sub = await app.request("/community/contributions", json({ payload: { kind: "pronunciation", lexemeId: 2, romanization: "ketāb" } }, author.token));
    const { id } = await sub.json();
    await app.request(`/community/contributions/${id}/vote`, json({ vote: "verify" }, voter.token));
    const detail = await (await app.request("/dictionary/lexemes/2?native=de")).json();
    expect(detail.romanization).toBe("ketāb");
  });

  it("does not overwrite an existing pronunciation", async () => {
    const author = await user("pron-b@example.com");
    const voter = await user("pron-w@example.com");
    const { id } = await (await app.request("/community/contributions", json({ payload: { kind: "pronunciation", lexemeId: 1, romanization: "ab" } }, author.token))).json();
    await app.request(`/community/contributions/${id}/vote`, json({ vote: "verify" }, voter.token));
    const detail = await (await app.request("/dictionary/lexemes/1?native=de")).json();
    expect(detail.romanization).toBe("āb");
  });
});
