import { describe, expect, it, beforeEach } from "vitest";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";
import { importLegacyFaDe } from "../src/importers/legacy-fa-de.js";
import { importWordhoard } from "../src/importers/wordhoard.js";
import { searchLexemes } from "../src/dictionary.js";

let now = 1_700_000_000_000;
let app: ReturnType<typeof createApp>;
let db: ReturnType<typeof openDb>;

const json = (body: unknown, token?: string) => ({
  method: "POST",
  headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const get = (token?: string): RequestInit => ({ headers: token ? { authorization: `Bearer ${token}` } : {} });

async function register(email: string, nativeLang = "de") {
  const res = await app.request("/auth/register", json({ email, password: "geheimes-passwort", name: "Test", nativeLang }));
  expect(res.status).toBe(201);
  return (await res.json()) as { token: string; user: { id: string } };
}

const card = (overrides: Record<string, unknown> = {}) => ({
  id: "card-0000000001",
  lang: "fa",
  lemma: "آب",
  lexemeId: null,
  gloss: "Wasser",
  note: "",
  cefr: "A1",
  status: "new",
  ease: 2.5,
  intervalDays: 0,
  dueAt: 0,
  reps: 0,
  lapses: 0,
  createdAt: 1,
  updatedAt: 100,
  deleted: false,
  ...overrides,
});

beforeEach(() => {
  now = 1_700_000_000_000;
  db = openDb(":memory:");
  app = createApp({ db, now: () => now });
});

describe("auth", () => {
  it("registers, logs in and returns the profile", async () => {
    const { token } = await register("olaf@example.com");
    const me = await app.request("/me", get(token));
    expect(me.status).toBe(200);
    expect((await me.json()).email).toBe("olaf@example.com");

    const login = await app.request("/auth/login", json({ email: "OLAF@example.com", password: "geheimes-passwort" }));
    expect(login.status).toBe(200);
  });

  it("rejects wrong passwords and unauthenticated access", async () => {
    await register("a@example.com");
    const bad = await app.request("/auth/login", json({ email: "a@example.com", password: "falsch-falsch" }));
    expect(bad.status).toBe(401);
    const anon = await app.request("/me");
    expect(anon.status).toBe(401);
  });

  it("expires sessions", async () => {
    const { token } = await register("b@example.com");
    now += 31 * 24 * 60 * 60 * 1000;
    const res = await app.request("/me", get(token));
    expect(res.status).toBe(401);
  });

  it("stores native and learning languages", async () => {
    const { token } = await register("c@example.com");
    const res = await app.request("/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ nativeLang: "en", learnLangs: [{ lang: "fa", targetCefr: "B1" }] }),
    });
    const body = await res.json();
    expect(body.nativeLang).toBe("en");
    expect(body.learnLangs).toEqual([{ lang: "fa", targetCefr: "B1" }]);
  });
});

describe("sync", () => {
  it("pushes rows and pulls them back incrementally", async () => {
    const { token } = await register("d@example.com");
    const push = await app.request("/sync/push", json({ ops: [{ entity: "cards", row: card() }] }, token));
    expect((await push.json()).accepted).toBe(1);

    const pull = await (await app.request("/sync/changes?since=0", get(token))).json();
    expect(pull.changes).toHaveLength(1);
    expect(pull.changes[0].row.lemma).toBe("آب");
    expect(pull.cursor).toBeGreaterThan(0);

    const again = await (await app.request(`/sync/changes?since=${pull.cursor}`, get(token))).json();
    expect(again.changes).toHaveLength(0);
  });

  it("applies last-write-wins by updatedAt", async () => {
    const { token } = await register("e@example.com");
    const send = (row: unknown) => app.request("/sync/push", json({ ops: [{ entity: "cards", row }] }, token));
    await send(card({ gloss: "neu", updatedAt: 200 }));
    const older = await (await send(card({ gloss: "alt", updatedAt: 100 }))).json();
    expect(older.accepted).toBe(0);

    const pull = await (await app.request("/sync/changes?since=0", get(token))).json();
    expect(pull.changes[0].row.gloss).toBe("neu");
  });

  it("rejects invalid rows without failing the batch", async () => {
    const { token } = await register("f@example.com");
    const res = await (
      await app.request("/sync/push", json({ ops: [{ entity: "cards", row: { id: "x" } }, { entity: "cards", row: card() }] }, token))
    ).json();
    expect(res.accepted).toBe(1);
    expect(res.rejected).toHaveLength(1);
  });

  it("keeps users' data separate", async () => {
    const a = await register("g@example.com");
    const b = await register("h@example.com");
    await app.request("/sync/push", json({ ops: [{ entity: "messages", row: { id: "msg-0000000001", role: "user", kind: "text", body: "hi", payload: null, createdAt: 1, updatedAt: 1, deleted: false } }] }, a.token));
    const pull = await (await app.request("/sync/changes?since=0", get(b.token))).json();
    expect(pull.changes).toHaveLength(0);
  });
});

describe("dictionary", () => {
  beforeEach(() => {
    db.exec("INSERT INTO lexemes (id, lang, lemma, pos, frequency_rank) VALUES (1, 'de', 'Haus', 'noun', 226), (2, 'de', 'Hausa', '', NULL), (3, 'de', 'Hund', 'noun', 900)");
    db.exec("INSERT INTO senses (lexeme_id, position, gloss_lang, gloss, source) VALUES (1, 0, 'en', 'house', 't'), (1, 1, 'fa', 'خانه', 't')");
    db.exec("INSERT INTO translations (lexeme_id, target_lang, target_lemma, source) VALUES (1, 'en', 'house', 't')");
  });

  it("finds exact matches first, case-insensitively, with a gloss in the native language", async () => {
    const { token } = await register("i@example.com", "en");
    const res = await (await app.request("/dictionary/search?lang=de&q=haus&native=en", get(token))).json();
    expect(res[0].lemma).toBe("Haus");
    expect(res[0].gloss).toBe("house");
    expect(res.map((r: { lemma: string }) => r.lemma)).toContain("Hausa");
  });

  it("returns lexeme details with senses and translations", async () => {
    const { token } = await register("j@example.com", "en");
    const detail = await (await app.request("/dictionary/lexemes/1?native=en", get(token))).json();
    expect(detail.senses[0].gloss).toBe("house");
    expect(detail.translations[0].targetLemma).toBe("house");
  });

  it("filters by CEFR level", async () => {
    const { token } = await register("k@example.com");
    db.exec("UPDATE lexemes SET cefr = 'A1' WHERE id = 1");
    const res = await (await app.request("/dictionary/browse?lang=de&cefr=A1", get(token))).json();
    expect(res.map((r: { id: number }) => r.id)).toEqual([1]);
  });

  it("imports legacy Farsi data and wordhoard CSV", () => {
    importLegacyFaDe(db, "test", JSON.stringify([{ vocLanguage: "Farsi", vocab: ["آب"], pronunciation: ["āb"], translation: ["Wasser"], hints: [{ voc: "آب آشامیدنی [āb-e āšāmidani]", trans: ["Trinkwasserخنثی | Neutrum n"] }] }]));
    const row = db.prepare("SELECT id, romanization FROM lexemes WHERE lang = 'fa' AND lemma = 'آب'").get() as { id: number; romanization: string };
    expect(row.romanization).toBe("āb");
    const ex = db.prepare("SELECT text, translation FROM examples WHERE lexeme_id = ?").get(row.id) as { text: string; translation: string };
    expect(ex).toEqual({ text: "آب آشامیدنی", translation: "Trinkwasser" });

    importWordhoard(db, "de", 'lemma,pos,gender,frequency_rank,frequency_count,cefr_estimate,notes,forms\nHaus,NOUN,das,226,1000,A1,x,\n', "test");
    const haus = db.prepare("SELECT gender, cefr, frequency_rank FROM lexemes WHERE lang = 'de' AND lemma = 'Haus' AND pos = 'noun'").get();
    expect(haus).toEqual({ gender: "n", cefr: "A1", frequency_rank: 226 });
  });
});

describe("persian search", () => {
  it("finds lemmas written with Arabic yeh/kaf when searching with Persian letters", () => {
    db.exec("INSERT INTO lexemes (id, lang, lemma, pos, frequency_rank) VALUES (50, 'fa', 'ميپريد', '', 12)");
    db.exec("INSERT INTO lexemes (id, lang, lemma, pos, frequency_rank) VALUES (51, 'fa', 'کتاب', '', 3)");
    const persian = searchLexemes(db, { lang: "fa", q: "می", nativeLang: "de", limit: 10 });
    expect(persian.map((r) => r.id)).toContain(50);
    const kaf = searchLexemes(db, { lang: "fa", q: "كتا", nativeLang: "de", limit: 10 });
    expect(kaf.map((r) => r.id)).toEqual([51]);
  });
});

describe("optional login and catalog", () => {
  const collection = (overrides: Record<string, unknown> = {}) => ({
    id: "coll-0000000001", kind: "media", mediaType: "song", title: "Mein Lied", description: "Test", lang: "de", level: "B1",
    visibility: "public", ownerName: "Olaf",
    items: [{ lemma: "Haus", lang: "de", lexemeId: 1, gloss: "house", cefr: "A1" }, { lemma: "Liebe", lang: "de", lexemeId: null, gloss: null, cefr: null }],
    createdAt: 1, updatedAt: 1, deleted: false, ...overrides,
  });

  it("serves dictionary and catalog without any login", async () => {
    db.exec("INSERT INTO lexemes (id, lang, lemma, pos, frequency_rank) VALUES (1, 'de', 'Haus', 'noun', 1)");
    expect((await app.request("/dictionary/search?lang=de&q=Ha")).status).toBe(200);
    expect((await app.request("/catalog/paths?lang=de")).status).toBe(200);
    expect((await app.request("/sync/changes?since=0")).status).toBe(401);
  });

  it("publishes a public collection via sync and lists it in the catalog", async () => {
    const { token } = await register("cat1@example.com");
    await app.request("/sync/push", json({ ops: [{ entity: "collections", row: collection() }] }, token));
    const list = await (await app.request("/catalog/collections?kind=media&mediaType=song")).json();
    expect(list.map((c: { title: string }) => c.title)).toEqual(["Mein Lied"]);
    const detail = await (await app.request("/catalog/collections/coll-0000000001")).json();
    expect(detail.items).toHaveLength(2);
  });

  it("keeps private collections out of the catalog", async () => {
    const { token } = await register("cat2@example.com");
    await app.request("/sync/push", json({ ops: [{ entity: "collections", row: collection({ id: "coll-0000000002", visibility: "private" }) }] }, token));
    expect(await (await app.request("/catalog/collections")).json()).toEqual([]);
    expect((await app.request("/catalog/collections/coll-0000000002")).status).toBe(404);
  });

  it("requires login to rate and aggregates ratings", async () => {
    const owner = await register("cat3@example.com");
    await app.request("/sync/push", json({ ops: [{ entity: "collections", row: collection({ id: "coll-0000000003" }) }] }, owner.token));
    const anon = await app.request("/catalog/collections/coll-0000000003/rating", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ difficulty: 4 }) });
    expect(anon.status).toBe(401);

    const a = await register("rater1@example.com");
    const b = await register("rater2@example.com");
    const rate = (token: string, d: number) => app.request("/catalog/collections/coll-0000000003/rating", { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ difficulty: d }) });
    expect((await rate(a.token, 2)).status).toBe(200);
    expect((await rate(b.token, 4)).status).toBe(200);
    const detail = await (await app.request("/catalog/collections/coll-0000000003", get(a.token))).json();
    expect(detail.rating).toEqual({ average: 3, count: 2 });
    expect(detail.myRating).toBe(2);
  });

  it("syncs learning reviews as an append-only log", async () => {
    const { token } = await register("rev@example.com");
    const review = { id: "rev-0000000001", cardId: "card-0000000001", lang: "fa", lemma: "آب", outcome: "wrong", mode: "type", typed: "ab", at: 5, updatedAt: 5, deleted: false };
    const res = await (await app.request("/sync/push", json({ ops: [{ entity: "reviews", row: review }] }, token))).json();
    expect(res.accepted).toBe(1);
    const pull = await (await app.request("/sync/changes?since=0", get(token))).json();
    expect(pull.changes[0].entity).toBe("reviews");
  });
});

describe("extraction and Japanese", () => {
  it("extracts known words from a text and lists unknown ones", async () => {
    const { token } = await (async () => {
      const r = await app.request("/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "ex@example.com", password: "geheimes-passwort", name: "Ex", nativeLang: "de" }) });
      return (await r.json()) as { token: string };
    })();
    db.exec("INSERT INTO lexemes (id, lang, lemma, pos, frequency_rank) VALUES (901, 'de', 'Haus', 'noun', 1), (902, 'de', 'Hund', 'noun', 2)");
    db.exec("INSERT INTO senses (lexeme_id, position, gloss_lang, gloss, source) VALUES (901, 0, 'de', 'Gebäude', 't')");
    const res = await app.request("/dictionary/extract?native=de", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ lang: "de", text: "Der Hund sieht das Haus. Haus! Zebra." }) });
    const body = await res.json();
    expect(body.matches.map((m: { lemma: string }) => m.lemma).sort()).toEqual(["Haus", "Hund"]);
    expect(body.unknown).toEqual(expect.arrayContaining(["Der", "sieht", "das", "Zebra"]));
    expect(body.matches.find((m: { lemma: string }) => m.lemma === "Haus").gloss).toBe("Gebäude");
  });

  it("accepts Japanese as a learning language", async () => {
    const r = await app.request("/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "ja@example.com", password: "geheimes-passwort", name: "Ja", nativeLang: "de" }) });
    const { token } = (await r.json()) as { token: string };
    const res = await app.request("/me", { method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ learnLangs: [{ lang: "ja", targetCefr: null }] }) });
    expect(res.status).toBe(200);
  });
});
