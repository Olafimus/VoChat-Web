import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db/index.js";
import { addGloss, addLexeme, testDb } from "./helpers.js";
import { LocalMediaStore } from "../src/media.js";

let db: Db;
let app: ReturnType<typeof createApp>;
let mediaDir: string;

const json = (body: unknown, token?: string, method = "POST") => ({
  method,
  headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const auth = (token: string, method = "GET") => ({ method, headers: { authorization: `Bearer ${token}` } });

async function user(email: string, name = email.split("@")[0]) {
  const res = await app.request("/auth/register", json({ email, password: "geheimes-passwort", name, nativeLang: "de" }));
  const body = (await res.json()) as { token: string; user: { id: string } };
  return body;
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

beforeEach(async () => {
  db = await testDb();
  mediaDir = mkdtempSync(join(tmpdir(), "vochat-media-"));
  app = createApp({ db, media: new LocalMediaStore(mediaDir) });
});

describe("profile and avatar", () => {
  it("updates bio and visibility", async () => {
    const a = await user("p1@example.com");
    const res = await app.request("/me", json({ bio: "Ich lerne Persisch", profilePublic: false, showProgress: true }, a.token, "PATCH"));
    const body = await res.json();
    expect(body.bio).toBe("Ich lerne Persisch");
    expect(body.profilePublic).toBe(false);
    expect(body.showProgress).toBe(true);
  });

  it("reports the avatar feature as disabled without a media store", async () => {
    const off = createApp({ db: await testDb() });
    expect(await (await off.request("/features")).json()).toEqual({ avatars: false, mediaDriver: null });
    const reg = await off.request("/auth/register", json({ email: "p2@example.com", password: "geheimes-passwort", name: "p2", nativeLang: "de" }));
    const a = (await reg.json()) as { token: string };
    const res = await off.request("/me/avatar", { method: "PUT", headers: { authorization: `Bearer ${a.token}`, "content-type": "image/png" }, body: PNG });
    expect(res.status).toBe(503);
  });

  it("accepts real image types only and serves the avatar", async () => {
    const a = await user("p3@example.com");
    const up = await app.request("/me/avatar", { method: "PUT", headers: { authorization: `Bearer ${a.token}`, "content-type": "image/png" }, body: PNG });
    expect(up.status).toBe(200);
    const profile = await up.json();
    expect(profile.avatarUrl).toContain(`/media/avatars/${a.user.id}`);
    const img = await app.request(`/media/avatars/${a.user.id}`);
    expect(img.status).toBe(200);
    expect(img.headers.get("content-type")).toBe("image/png");

    const fake = await app.request("/me/avatar", { method: "PUT", headers: { authorization: `Bearer ${a.token}`, "content-type": "image/png" }, body: new TextEncoder().encode("<script>") });
    expect(fake.status).toBe(415);
  });

  it("rejects oversized avatars", async () => {
    const a = await user("p4@example.com");
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set(PNG);
    const res = await app.request("/me/avatar", { method: "PUT", headers: { authorization: `Bearer ${a.token}` }, body: big });
    expect(res.status).toBe(413);
  });
});

describe("follow and friends", () => {
  it("follows public profiles immediately and private ones after approval", async () => {
    const pub = await user("pub@example.com");
    const priv = await user("priv@example.com");
    const fan = await user("fan@example.com");
    await app.request("/me", json({ profilePublic: false }, priv.token, "PATCH"));

    expect((await (await app.request(`/social/follow/${pub.user.id}`, auth(fan.token, "POST"))).json()).state).toBe("accepted");
    expect((await (await app.request(`/social/follow/${priv.user.id}`, auth(fan.token, "POST"))).json()).state).toBe("requested");

    const requests = await (await app.request("/social/requests", auth(priv.token))).json();
    expect(requests.follows.map((f: { id: string }) => f.id)).toEqual([fan.user.id]);
    const accept = await app.request(`/social/follow-requests/${fan.user.id}/accept`, auth(priv.token, "POST"));
    expect(accept.status).toBe(200);

    const followers = await (await app.request(`/social/followers/${priv.user.id}`)).json();
    expect(followers.map((f: { id: string }) => f.id)).toEqual([fan.user.id]);
  });

  it("makes a friendship mutual when both sides ask", async () => {
    const a = await user("fa@example.com");
    const b = await user("fb@example.com");
    expect((await (await app.request(`/social/friends/${b.user.id}`, auth(a.token, "POST"))).json()).state).toBe("outgoing");
    const incoming = await (await app.request("/social/requests", auth(b.token))).json();
    expect(incoming.friends.map((f: { id: string }) => f.id)).toEqual([a.user.id]);
    await app.request(`/social/friends/${a.user.id}/accept`, auth(b.token, "POST"));
    const friendsOfA = await (await app.request("/social/friends", auth(a.token))).json();
    expect(friendsOfA.map((f: { id: string }) => f.id)).toEqual([b.user.id]);
  });

  it("does not expose a private profile's details to strangers", async () => {
    const priv = await user("hidden@example.com");
    await app.request("/me", json({ profilePublic: false, bio: "geheim" }, priv.token, "PATCH"));
    const stranger = await user("stranger@example.com");
    const view = await (await app.request(`/users/${priv.user.id}`, auth(stranger.token))).json();
    expect(view.isPrivate).toBe(true);
    expect(view.bio).toBeNull();
    expect(view.stats).toBeNull();
  });

  it("shares learning progress only with friends who are allowed to see it", async () => {
    const a = await user("prog-a@example.com");
    const b = await user("prog-b@example.com");
    await app.request("/me", json({ showProgress: true }, a.token, "PATCH"));
    await db.run(
      "INSERT INTO sync_rows (user_id, entity, id, data, attr, updated_at, deleted, seq) VALUES (?, 'cards', 'c1', ?, 'review', 1, 0, 1)",
      [a.user.id, JSON.stringify({ id: "c1", status: "review", deleted: false })],
    );
    const before = await (await app.request(`/users/${a.user.id}`, auth(b.token))).json();
    expect(before.progress).toBeNull();
    await app.request(`/social/friends/${a.user.id}`, auth(b.token, "POST"));
    await app.request(`/social/friends/${b.user.id}/accept`, auth(a.token, "POST"));
    const after = await (await app.request(`/users/${a.user.id}`, auth(b.token))).json();
    expect(after.progress).toEqual({ known: 1, learning: 0 });
  });

  it("builds a feed from friends' and followed users' public work", async () => {
    const author = await user("feedauthor@example.com", "Autorin");
    const reader = await user("feedreader@example.com");
    const row = {
      id: "coll-feed-0001", kind: "media", mediaType: "song", title: "Lieblingslied", description: "", lang: "fa", level: null,
      visibility: "public", ownerName: "Autorin", items: [], createdAt: 1, updatedAt: 5, deleted: false,
    };
    await app.request("/sync/push", json({ ops: [{ entity: "collections", row }] }, author.token));
    await app.request(`/social/follow/${author.user.id}`, auth(reader.token, "POST"));
    const feedItems = await (await app.request("/social/feed", auth(reader.token))).json();
    expect(feedItems[0]).toMatchObject({ type: "collection", title: "Lieblingslied", userName: "Autorin" });
  });

  it("lists public collections of one owner for a profile page", async () => {
    const a = await user("owner-a@example.com");
    const row = {
      id: "coll-owner-0001", kind: "path", mediaType: null, title: "Mein Pfad", description: "", lang: "de", level: null,
      visibility: "public", ownerName: "a", items: [], createdAt: 1, updatedAt: 1, deleted: false,
    };
    await app.request("/sync/push", json({ ops: [{ entity: "collections", row }] }, a.token));
    const list = await (await app.request(`/catalog/collections?owner=${a.user.id}`)).json();
    expect(list.map((c: { title: string }) => c.title)).toEqual(["Mein Pfad"]);
    const other = await (await app.request(`/catalog/collections?owner=someone-else`)).json();
    expect(other).toEqual([]);
  });

  it("finds public users by name but not private ones", async () => {
    await user("finder-public@example.com", "Sophie Public");
    const hidden = await user("finder-hidden@example.com", "Sophie Hidden");
    await app.request("/me", json({ profilePublic: false }, hidden.token, "PATCH"));
    const searcher = await user("searcher@example.com");
    const found = await (await app.request("/social/users?q=Sophie", auth(searcher.token))).json();
    expect(found.map((u: { name: string }) => u.name)).toEqual(["Sophie Public"]);
  });
});
