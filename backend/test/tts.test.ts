import { describe, expect, it } from "vitest";
import { normalizeTtsText, Tts } from "../src/tts.js";

describe("tts", () => {
  it("normalizes input", () => {
    expect(normalizeTtsText("  --help\n me ")).toBe("help me");
    expect(normalizeTtsText("x".repeat(500))).toHaveLength(200);
  });

  it("synthesizes a wav for every language and caches it", async () => {
    const tts = new Tts();
    for (const [lang, text] of [["de", "ich esse"], ["en", "hello"], ["es", "comer"], ["fa", "آب"], ["ja", "ありがとう"]] as const) {
      const wav = await tts.synthesize(lang, text);
      expect(wav, lang).not.toBeNull();
      expect(Buffer.from(wav!.subarray(0, 4)).toString("ascii")).toBe("RIFF");
      expect(wav!.length, lang).toBeGreaterThan(2000);
    }
    const a = await tts.synthesize("de", "ich esse");
    const b = await tts.synthesize("de", "ich esse");
    expect(a).toBe(b);
  }, 60_000);
});

describe("tts ipa", () => {
  it("produces an IPA transcription", async () => {
    const ipa = await new Tts().ipa("fa", "کتاب");
    expect(ipa).toMatch(/k/);
    expect(ipa).not.toContain("_");
    expect(await new Tts().ipa("de", "essen")).toMatch(/s/);
  }, 30_000);
});
