import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { grantRole } from "../src/community.js";
import type { Db } from "../src/db/index.js";
import { addGloss, addLexeme, testDb } from "./helpers.js";

let db: Db;
let app: ReturnType<typeof createApp>;
const now = Date.UTC(2026, 10, 4, 12); // Mittwoch

const req = (path: string, token?: string, method = "GET", body?: unknown) =>
  app.request(path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });

async function user(email: string, name = email.split("@")[0]) {
  const r = await req("/auth/register", undefined, "POST", { email, password: "geheimes-passwort", name, nativeLang: "de" });
  return (await r.json()) as { token: string; user: { id: string } };
}
async function befriend(a: { token: string; user: { id: string } }, b: { token: string; user: { id: string } }) {
  await req(`/social/friends/${b.user.id}`, a.token, "POST");
  await req(`/social/friends/${a.user.id}/accept`, b.token, "POST");
}
const card = (id: string, lemma: string, status: string, lexemeId: number | null = null) => ({
  id, lang: "fa", lemma, lexemeId, gloss: null, pronunciation: null, custom: [], note: "", cefr: null, status,
  ease: 2.5, intervalDays: 1, dueAt: 0, reps: 1, lapses: 0, createdAt: 1, updatedAt: now, deleted: false,
});
const review = (id: string, lemma: string, outcome: "right" | "wrong", at: number) => ({
  id, cardId: "card-x-000001", lang: "fa", lemma, outcome, mode: "type", typed: null, at, updatedAt: at, deleted: false,
});

beforeEach(async () => {
  db = await testDb();
  app = createApp({ db, now: () => now });
});

describe("challenges", () => {
  it("lets friends compete on a shared word list and ranks them", async () => {
    const a = await user("ch-a@example.com", "Anna");
    const b = await user("ch-b@example.com", "Ben");
    await befriend(a, b);
    const items = [{ lemma: "آب", lang: "fa" }, { lemma: "خانه", lang: "fa" }, { lemma: "کتاب", lang: "fa" }];
    const created = await req("/challenges", a.token, "POST", { kind: "duel", title: "Duell", lang: "fa", items, days: 7, invite: [b.user.id] });
    expect(created.status).toBe(201);
    const { id } = await created.json();

    // Ben ist eingeladen, aber noch nicht dabei
    expect((await (await req(`/challenges/${id}`, b.token)).json()).myStatus).toBe("invited");
    await req(`/challenges/${id}/accept`, b.token, "POST");

    // Anna kennt 2 Wörter (eines mit persischer Buchstabenvariante), Ben eines und hat 3 richtige Antworten
    await req("/sync/push", a.token, "POST", { ops: [
      { entity: "cards", row: card("card-a-000001", "آب", "review") },
      { entity: "cards", row: card("card-a-000002", "كتاب", "mastered") },
    ] });
    await req("/sync/push", b.token, "POST", { ops: [
      { entity: "cards", row: card("card-b-000001", "خانه", "review") },
      { entity: "reviews", row: review("rev-b-000001", "خانه", "right", now) },
      { entity: "reviews", row: review("rev-b-000002", "خانه", "right", now) },
      { entity: "reviews", row: review("rev-b-000003", "آب", "right", now) },
      { entity: "reviews", row: review("rev-b-000004", "غیر", "right", now) },
    ] });

    const detail = await (await req(`/challenges/${id}`, a.token)).json();
    const board = detail.leaderboard.map((e: { name: string; known: number; correct: number; points: number }) => [e.name, e.known, e.correct, e.points]);
    expect(board).toEqual([
      ["Anna", 2, 0, 20],
      ["Ben", 1, 3, 13],
    ]);
  });

  it("only allows friends to be invited", async () => {
    const a = await user("ch-c@example.com");
    const stranger = await user("ch-d@example.com");
    const res = await req("/challenges", a.token, "POST", { kind: "duel", title: "x", lang: "fa", items: [{ lemma: "آب", lang: "fa" }], days: 3, invite: [stranger.user.id] });
    expect(res.status).toBe(403);
    expect((await req(`/challenges/whatever`, stranger.token)).status).toBe(404);
  });

  it("creates one weekly challenge per language and week, open to everyone", async () => {
    for (let i = 0; i < 30; i++) {
      const id = await addLexeme(db, { lang: "fa", lemma: `واژه${i}`, rank: i + 1 });
      await addGloss(db, id, "de", `Wort ${i}`);
    }
    const a = await user("wk-a@example.com");
    const b = await user("wk-b@example.com");
    const w1 = await (await req("/challenges/weekly?lang=fa", a.token)).json();
    const w2 = await (await req("/challenges/weekly?lang=fa", b.token)).json();
    expect(w1.id).toBe(w2.id);
    expect(w1.itemCount).toBe(25);
    expect(new Date(w1.startsAt).getUTCDay()).toBe(1); // Montag
    await req(`/challenges/${w1.id}/join`, b.token, "POST");
    const after = await (await req(`/challenges/${w1.id}`, a.token)).json();
    expect(after.members).toBe(1);
    expect(after.leaderboard[0].name).toBe("wk-b"); // öffentliches Profil -> Name sichtbar
  });
});

describe("expert review with suspicion propagation and history", () => {
  it("starts unreviewed, surfaces related entries after a correction, and logs everything", async () => {
    const expert = await user("exp@example.com", "Experte");
    await grantRole(db, expert.user.id, "expert", "fa", now);
    const a = await addLexeme(db, { lang: "fa", lemma: "شیر", rank: 10 });
    const b = await addLexeme(db, { lang: "fa", lemma: "شیرینی", rank: 20 });
    const c = await addLexeme(db, { lang: "fa", lemma: "دیگر", rank: 5 });
    await addGloss(db, a, "de", "Löwe");
    await addGloss(db, a, "de", "Wasserhahn", 1);
    await addGloss(db, b, "de", "Löwe"); // falsch: gleicher Fehler wie bei a vermutet
    await addGloss(db, c, "de", "anders");

    const q1 = await (await req("/review/queue?lang=fa", expert.token)).json();
    expect(q1.entries.every((e: { status: string }) => e.status === "unreviewed")).toBe(true);
    expect(q1.entries[0].lemma).toBe("دیگر"); // ohne Verdacht: häufigste zuerst

    const senseId = q1.entries.find((e: { id: number }) => e.id === a).senses[0].id;
    const edit = await (await req(`/review/lexemes/${a}`, expert.token, "POST", { action: "editSense", senseId, gloss: "Milch / Löwe" })).json();
    expect(edit.suspicious).toBe(1);
    // Die korrigierte Bedeutung bleibt an erster Stelle (nicht hinter „Wasserhahn“)
    const detail = await (await req(`/dictionary/lexemes/${a}?native=de`)).json();
    expect(detail.gloss).toBe("Milch / Löwe");

    const q2 = await (await req("/review/queue?lang=fa", expert.token)).json();
    expect(q2.entries[0].id).toBe(b); // verdächtiger Eintrag ganz oben
    expect(q2.entries[0].suspicions[0].reason).toContain("Löwe");

    await req(`/review/lexemes/${b}`, expert.token, "POST", { action: "approve" });
    const q3 = await (await req("/review/queue?lang=fa&filter=suspicious", expert.token)).json();
    expect(q3.entries).toHaveLength(0);

    const history = await (await req(`/history/lexemes/${a}`)).json();
    expect(history[0]).toMatchObject({ action: "sense.edit", actor: { name: "Experte" }, details: { from: "Löwe", to: "Milch / Löwe" } });
  });

  it("marks entries sharing a newly added translation as suspicious", async () => {
    const expert = await user("exp2@example.com");
    await grantRole(db, expert.user.id, "expert", "fa", now);
    const a = await addLexeme(db, { lang: "fa", lemma: "دست", rank: 1 });
    const b = await addLexeme(db, { lang: "fa", lemma: "دسته", rank: 2 });
    await db.run("INSERT INTO translations (lexeme_id, target_lang, target_lemma, source) VALUES (?, 'en', 'hand', 't')", [b]);
    const r = await (await req(`/review/lexemes/${a}`, expert.token, "POST", { action: "addTranslation", targetLang: "en", targetLemma: "hand" })).json();
    expect(r.suspicious).toBe(1);
  });

  it("denies the review queue to non-experts and experts of other languages", async () => {
    const plain = await user("plain2@example.com");
    const esExpert = await user("es-exp@example.com");
    await grantRole(db, esExpert.user.id, "expert", "es", now);
    expect((await req("/review/queue?lang=fa", plain.token)).status).toBe(403);
    expect((await req("/review/queue?lang=fa", esExpert.token)).status).toBe(403);
  });
});

describe("comment trees and reputation", () => {
  it("threads replies, rates comments and counts them into reputation", async () => {
    const author = await user("cm-a@example.com");
    const other = await user("cm-b@example.com");
    const lex = await addLexeme(db, { lang: "fa", lemma: "آب", rank: 1 });
    const root = await (await req("/comments", author.token, "POST", { target: `lexeme:${lex}`, body: "Bedeutung unvollständig?" })).json();
    const reply = await req("/comments", other.token, "POST", { target: `lexeme:${lex}`, parentId: root.id, body: "Stimmt, auch 'Glanz'." });
    expect(reply.status).toBe(201);
    expect((await req(`/comments/${root.id}/vote`, author.token, "POST", { value: 1 })).status).toBe(403); // eigener Kommentar
    await req(`/comments/${root.id}/vote`, other.token, "POST", { value: 1 });
    const list = await (await req(`/comments?target=lexeme:${lex}`, other.token)).json();
    expect(list).toHaveLength(2);
    expect(list[1].parentId).toBe(root.id);
    expect(list[0]).toMatchObject({ score: 1, myVote: 1 });
    const me = await (await req("/community/me", author.token)).json();
    expect(me.reputation.commentScore).toBe(1);
    expect(me.reputation.score).toBe(1);
  });

  it("rejects replies that point into another thread", async () => {
    const u = await user("cm-c@example.com");
    const l1 = await addLexeme(db, { lang: "fa", lemma: "یک", rank: 1 });
    const l2 = await addLexeme(db, { lang: "fa", lemma: "دو", rank: 2 });
    const root = await (await req("/comments", u.token, "POST", { target: `lexeme:${l1}`, body: "x" })).json();
    expect((await req("/comments", u.token, "POST", { target: `lexeme:${l2}`, parentId: root.id, body: "y" })).status).toBe(400);
  });
});

describe("notifications", () => {
  it("collects friend requests, challenge invites and comment replies", async () => {
    const a = await user("n-a@example.com", "Anna");
    const b = await user("n-b@example.com", "Ben");
    const c = await user("n-c@example.com", "Cleo");
    await befriend(a, b);
    await req(`/social/friends/${b.user.id}`, c.token, "POST"); // Cleo fragt Ben an
    const created = await req("/challenges", a.token, "POST", { kind: "duel", title: "Duell", lang: "fa", items: [{ lemma: "آب", lang: "fa" }], days: 7, invite: [b.user.id] });
    const { id } = await created.json();
    await addLexeme(db, { id: 77, lang: "fa", lemma: "آب" });
    const root = await (await req("/comments", b.token, "POST", { target: "lexeme:77", body: "Aussprache?" })).json();
    await req("/comments", a.token, "POST", { target: "lexeme:77", body: "āb", parentId: root.id });

    const list = (await (await req("/notifications", b.token)).json()) as { kind: string; actor: { name: string } | null; target: string; text: string }[];
    const kinds = list.map((n) => n.kind).sort();
    expect(kinds).toEqual(["challenge_invite", "comment_reply", "friend_request"]);
    expect(list.find((n) => n.kind === "challenge_invite")!.target).toBe(`challenge:${id}`);
    expect(list.find((n) => n.kind === "friend_request")!.actor!.name).toBe("Cleo");
    expect(list.find((n) => n.kind === "comment_reply")!.text).toContain("āb");
    expect((await req("/notifications")).status).toBe(401);
  });
});
