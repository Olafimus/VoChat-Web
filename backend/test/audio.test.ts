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
    expect(r.recordings).toEqual([{ url: "https://upload.wikimedia.org/x.mp3", license: "CC BY-SA 4.0", speaker: "Jane", region: null, source: "commons:de" }]);
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
