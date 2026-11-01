import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import type { Db } from "../src/db/index.js";
import { addAudio } from "../src/importers/common.js";
import { addLexeme, testDb } from "./helpers.js";

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  db = await testDb();
  await addLexeme(db, { id: 1, lang: "de", lemma: "essen", rank: 1 });
  await addAudio(db, 1, { url: "https://upload.wikimedia.org/x.mp3", source: "commons:de", license: "CC BY-SA 4.0", speaker: "Jane" });
  app = createApp({ db });
});

describe("audio", () => {
  it("lists recordings for a lexeme and includes them in the detail", async () => {
    const r = await (await app.request("/audio/lexemes/1")).json();
    expect(r.recordings).toEqual([
      { id: expect.any(Number), url: "https://upload.wikimedia.org/x.mp3", license: "CC BY-SA 4.0", speaker: "Jane", region: null, source: "commons:de", status: "approved", mine: false },
    ]);
    const d = await (await app.request("/dictionary/lexemes/1?native=en")).json();
    expect(d.audio).toHaveLength(1);
  });

  it("generates speech as cacheable wav", async () => {
    const res = await app.request("/audio/tts?lang=fa&text=" + encodeURIComponent("کتاب"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(res.headers.get("cache-control")).toContain("immutable");
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(2000);
    expect((await app.request("/audio/tts?lang=xx&text=a")).status).toBe(400);
    expect((await app.request("/audio/tts?lang=de&text=")).status).toBe(400);
  }, 30_000);

  it("can be switched off", async () => {
    const off = createApp({ db, tts: null });
    expect((await off.request("/audio/tts?lang=de&text=hallo")).status).toBe(503);
  });
});

describe("user recordings", () => {
  const store = () => {
    const files = new Map<string, { body: Uint8Array; contentType: string }>();
    return {
      files,
      media: {
        driver: "local" as const,
        put: async (key: string, body: Uint8Array, contentType: string) => void files.set(key, { body, contentType }),
        get: async (key: string) => files.get(key) ?? null,
        delete: async (key: string) => void files.delete(key),
      },
    };
  };
  const ogg = () => {
    const b = new Uint8Array(4000);
    b.set([0x4f, 0x67, 0x67, 0x53]); // "OggS"
    return b;
  };
  const register = async (a: ReturnType<typeof createApp>, email: string) =>
    ((await (await a.request("/auth/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: "geheimes-passwort", name: email.split("@")[0], nativeLang: "en" }) })).json()) as { token: string; user: { id: string } });
  const upload = (a: ReturnType<typeof createApp>, token: string, body: Uint8Array, id = 1) =>
    a.request(`/audio/lexemes/${id}/recordings`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "audio/ogg", "x-duration-ms": "1800" }, body: body as Uint8Array<ArrayBuffer> });

  it("stores a recording, keeps it pending until an expert approves it", async () => {
    const { media, files } = store();
    const a = createApp({ db, media });
    const anna = await register(a, "rec-anna@example.com");
    const eve = await register(a, "rec-eve@example.com");
    const { grantRole } = await import("../src/community.js");
    await grantRole(db, eve.user.id, "expert", "de", Date.now());

    const res = await upload(a, anna.token, ogg());
    expect(res.status).toBe(201);
    const rec = await res.json();
    expect(rec).toMatchObject({ status: "pending", mine: true, source: "user" });
    expect(files.size).toBe(1);

    // Andere sehen ausstehende Aufnahmen nicht, die Sprecherin schon, Experten auch
    expect((await (await a.request("/audio/lexemes/1")).json()).recordings).toHaveLength(1); // nur Commons
    const own = await (await a.request("/audio/lexemes/1", { headers: { authorization: `Bearer ${anna.token}` } })).json();
    expect(own.recordings.map((r: { mine: boolean }) => r.mine)).toEqual([false, true]);
    const queue = await (await a.request("/review/queue?lang=de&filter=recordings", { headers: { authorization: `Bearer ${eve.token}` } })).json();
    expect(queue.entries[0].recordings[0].id).toBe(rec.id);

    // Datei abrufbar über den (zufälligen) Pfad
    const file = await a.request(rec.url);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-type")).toBe("audio/ogg");

    // Freigabe → für alle sichtbar
    const ok = await a.request("/review/lexemes/1", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${eve.token}` }, body: JSON.stringify({ action: "approveRecording", recordingId: rec.id }) });
    expect(ok.status).toBe(200);
    expect((await (await a.request("/audio/lexemes/1")).json()).recordings).toHaveLength(2);

    // Neue Aufnahme ersetzt die alte
    await upload(a, anna.token, ogg());
    expect(files.size).toBe(1);
    expect((await a.request(rec.url)).status).toBe(404);
  });

  it("rejects bad uploads and allows deletion by the owner", async () => {
    const { media } = store();
    const a = createApp({ db, media });
    const anna = await register(a, "rec-b@example.com");
    const other = await register(a, "rec-c@example.com");
    expect((await upload(a, anna.token, new Uint8Array(4000))).status).toBe(415); // kein Audio
    expect((await upload(a, anna.token, ogg().subarray(0, 100))).status).toBe(400); // zu kurz
    expect((await upload(a, anna.token, new Uint8Array(300 * 1024))).status).toBe(413);
    expect((await upload(a, anna.token, ogg(), 999)).status).toBe(404);
    const rec = await (await upload(a, anna.token, ogg())).json();
    expect((await a.request(`/audio/recordings/${rec.id}`, { method: "DELETE", headers: { authorization: `Bearer ${other.token}` } })).status).toBe(403);
    expect((await a.request(`/audio/recordings/${rec.id}`, { method: "DELETE", headers: { authorization: `Bearer ${anna.token}` } })).status).toBe(200);
    // Ohne Medien-Speicher: abgeschaltet
    expect((await upload(createApp({ db }), anna.token, ogg())).status).toBe(503);
  });
});
