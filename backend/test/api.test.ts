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
    const res = await (await app.request("/dictionary/search?lang=de&q=haus", get(token))).json();
    expect(res[0].lemma).toBe("Haus");
    expect(res[0].gloss).toBe("house");
    expect(res.map((r: { lemma: string }) => r.lemma)).toContain("Hausa");
  });

  it("returns lexeme details with senses and translations", async () => {
    const { token } = await register("j@example.com", "en");
    const detail = await (await app.request("/dictionary/lexemes/1", get(token))).json();
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
