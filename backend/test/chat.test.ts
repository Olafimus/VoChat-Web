import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { ChatHub, type ChatEvent } from "../src/chat.js";
import type { Db } from "../src/db/index.js";
import { testDb } from "./helpers.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let hub: ChatHub;
let t = Date.UTC(2026, 10, 4, 12);
const files = new Map<string, { body: Uint8Array; contentType: string }>();
const media = {
  driver: "local" as const,
  put: async (key: string, body: Uint8Array, contentType: string) => void files.set(key, { body, contentType }),
  get: async (key: string) => files.get(key) ?? null,
  delete: async (key: string) => void files.delete(key),
};

const req = (path: string, token?: string, method = "GET", body?: unknown) =>
  app.request(path, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
async function user(email: string, name = email.split("@")[0]) {
  return (await (await req("/auth/register", undefined, "POST", { email, password: "geheimes-passwort", name, nativeLang: "de" })).json()) as {
    token: string;
    user: { id: string };
  };
}
async function befriend(a: { token: string; user: { id: string } }, b: { token: string; user: { id: string } }) {
  await req(`/social/friends/${b.user.id}`, a.token, "POST");
  await req(`/social/friends/${a.user.id}/accept`, b.token, "POST");
}

beforeEach(async () => {
  db = await testDb();
  hub = new ChatHub();
  files.clear();
  app = createApp({ db, media, chatHub: hub, now: () => (t += 1000) });
});

describe("chat", () => {
  it("lets friends chat with replies, reactions, corrections, read state and live events", async () => {
    const a = await user("c-a@example.com", "Anna");
    const b = await user("c-b@example.com", "Ben");
    const stranger = await user("c-x@example.com", "Xaver");
    expect((await req("/conversations", a.token, "POST", { userId: stranger.user.id })).status).toBe(403);
    await befriend(a, b);
    const { id } = await (await req("/conversations", a.token, "POST", { userId: b.user.id })).json();
    // gleicher Direktchat beim zweiten Öffnen
    expect((await (await req("/conversations", b.token, "POST", { userId: a.user.id })).json()).id).toBe(id);

    const events: ChatEvent[] = [];
    hub.subscribe(b.user.id, (e) => events.push(e));

    const m1 = await (await req(`/conversations/${id}/messages`, a.token, "POST", { body: "Hola, yo comí <script>alert(1)</script>", clientId: "client-0001" })).json();
    expect(m1.body).toContain("<script>"); // als Text gespeichert, das Escaping macht die Oberfläche
    // idempotent
    const again = await (await req(`/conversations/${id}/messages`, a.token, "POST", { body: "egal", clientId: "client-0001" })).json();
    expect(again.id).toBe(m1.id);
    expect(events).toEqual([{ type: "message", conversationId: id, messageId: m1.id }, { type: "message", conversationId: id, messageId: m1.id }]);

    const m2 = await (await req(`/conversations/${id}/messages`, b.token, "POST", { body: "¡Hola!", replyTo: m1.id })).json();
    expect(m2.replyTo.id).toBe(m1.id);
    expect((await req(`/messages/${m1.id}/reactions`, b.token, "POST", { emoji: "👍" })).status).toBe(200);
    expect((await req(`/messages/${m1.id}/reactions`, b.token, "POST", { emoji: "<b>" })).status).toBe(400);
    expect((await req(`/messages/${m1.id}/correction`, b.token, "POST", { body: "Hola, yo comí." })).status).toBe(200);
    expect((await req(`/messages/${m1.id}/correction`, a.token, "POST", { body: "x" })).status).toBe(400); // eigene

    const list = await (await req(`/conversations`, a.token)).json();
    expect(list[0]).toMatchObject({ id, kind: "dm", title: "Ben", unread: 1 });
    const page = await (await req(`/conversations/${id}/messages?limit=10`, a.token)).json();
    expect(page.map((m: { id: number }) => m.id)).toEqual([m2.id, m1.id]); // neueste zuerst
    const first = page[1];
    expect(first.reactions).toEqual([{ emoji: "👍", count: 1, mine: false }]);
    expect(first.correction).toEqual({ body: "Hola, yo comí.", byId: b.user.id });

    await req(`/conversations/${id}/read`, a.token, "POST", { messageId: m2.id });
    expect((await (await req(`/conversations`, a.token)).json())[0].unread).toBe(0);
    expect(events.some((e) => e.type === "read")).toBe(true);

    expect((await req(`/messages/abc/reactions`, a.token, "POST", { emoji: "👍" })).status).toBe(404);
    expect((await req(`/messages/99999999999`, a.token, "DELETE")).status).toBe(404);
    // Fremde sehen nichts
    expect((await req(`/conversations/${id}/messages`, stranger.token)).status).toBe(404);
    expect((await req(`/conversations/${id}/messages`, stranger.token, "POST", { body: "hi" })).status).toBe(404);
  });

  it("pages through long histories", async () => {
    const a = await user("p-a@example.com");
    const b = await user("p-b@example.com");
    await befriend(a, b);
    const { id } = await (await req("/conversations", a.token, "POST", { userId: b.user.id })).json();
    for (let i = 0; i < 55; i++) await req(`/conversations/${id}/messages`, i % 2 ? a.token : b.token, "POST", { body: `Nachricht ${i}` });
    const p1 = await (await req(`/conversations/${id}/messages?limit=30`, a.token)).json();
    const p2 = await (await req(`/conversations/${id}/messages?limit=30&before=${p1.at(-1).id}`, a.token)).json();
    expect(p1).toHaveLength(30);
    expect(p2).toHaveLength(25);
    expect(p2[0].body).toBe("Nachricht 24");
    const newer = await (await req(`/conversations/${id}/messages?after=${p1[1].id}`, a.token)).json();
    expect(newer.map((m: { body: string }) => m.body)).toEqual(["Nachricht 54"]);
  });

  it("edits, deletes and serves images and voice messages only via signed links", async () => {
    const a = await user("m-a@example.com");
    const b = await user("m-b@example.com");
    await befriend(a, b);
    const { id } = await (await req("/conversations", a.token, "POST", { userId: b.user.id })).json();
    const png = new Uint8Array(500);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    const up = (body: Uint8Array, q: string) =>
      app.request(`/conversations/${id}/media?${q}`, { method: "POST", headers: { authorization: `Bearer ${a.token}` }, body: body as Uint8Array<ArrayBuffer> });
    const img = await (await up(png, "kind=image&width=800&height=600&caption=Schau")).json();
    expect(img).toMatchObject({ kind: "image", body: "Schau", media: { type: "image/png", width: 800, height: 600 } });
    expect((await app.request(img.media.url)).status).toBe(200);
    expect((await app.request(img.media.url.replace(/s=[^&]+/, "s=falsch"))).status).toBe(404);
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>".padEnd(200, " "));
    expect((await up(html, "kind=image")).status).toBe(415);
    const ogg = new Uint8Array(3000);
    ogg.set([0x4f, 0x67, 0x67, 0x53]);
    const voice = await (await up(ogg, "kind=voice&durationMs=4200")).json();
    expect(voice.media).toMatchObject({ type: "audio/ogg", durationMs: 4200 });
    expect((await up(ogg, "kind=voice&durationMs=999999")).status).toBe(400);

    const txt = await (await req(`/conversations/${id}/messages`, a.token, "POST", { body: "Tippfeler" })).json();
    expect((await (await req(`/messages/${txt.id}`, a.token, "PATCH", { body: "Tippfehler" })).json()).editedAt).not.toBeNull();
    expect((await req(`/messages/${txt.id}`, b.token, "PATCH", { body: "x" })).status).toBe(404);
    expect((await req(`/messages/${img.id}`, a.token, "DELETE")).status).toBe(200);
    expect((await app.request(img.media.url)).status).toBe(404);
    const after = await (await req(`/conversations/${id}/messages?ids=${img.id}`, b.token)).json();
    expect(after[0]).toMatchObject({ deleted: true, media: null, body: "" });
  });

  it("creates groups of friends only", async () => {
    const a = await user("g-a@example.com");
    const b = await user("g-b@example.com");
    const c = await user("g-c@example.com");
    await befriend(a, b);
    expect((await req("/conversations", a.token, "POST", { title: "Lerngruppe", members: [b.user.id, c.user.id] })).status).toBe(403);
    await befriend(a, c);
    const { id } = await (await req("/conversations", a.token, "POST", { title: "Lerngruppe", members: [b.user.id, c.user.id] })).json();
    const list = await (await req("/conversations", c.token)).json();
    expect(list[0]).toMatchObject({ id, kind: "group", title: "Lerngruppe" });
    expect(list[0].members).toHaveLength(3);
  });
});
