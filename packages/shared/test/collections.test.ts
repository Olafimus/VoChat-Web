import { describe, expect, it } from "vitest";
import { collectionSchema, reviewSchema } from "../src/index.js";

describe("collection and review schemas", () => {
  it("accepts a media vocabulary with items", () => {
    const row = {
      id: "coll-0000000001", kind: "media", mediaType: "song", title: "Lied", description: "", lang: "de", level: "B1",
      visibility: "public", ownerName: "Olaf", items: [{ lemma: "Haus", lang: "de", lexemeId: 1, gloss: "house", cefr: "A1" }],
      createdAt: 1, updatedAt: 1, deleted: false,
    };
    expect(collectionSchema.safeParse(row).success).toBe(true);
  });

  it("rejects reviews with unknown outcomes", () => {
    const r = { id: "rev-00000001", cardId: "card-0000001", lang: "de", lemma: "Haus", outcome: "maybe", mode: "type", typed: null, at: 1, updatedAt: 1, deleted: false };
    expect(reviewSchema.safeParse(r).success).toBe(false);
  });
});

describe("languages", () => {
  it("includes Japanese as a learning language", async () => {
    const { isLangCode, LANGUAGES } = await import("../src/index.js");
    expect(isLangCode("ja")).toBe(true);
    expect(LANGUAGES.ja.name).toBe("Japanisch");
  });
});

describe("pronunciation", () => {
  it("keeps the romanization on cards and collection items", async () => {
    const { cardSchema, collectionSchema } = await import("../src/index.js");
    const card = { id: "card-0000000009", lang: "fa", lemma: "آب", lexemeId: 1, gloss: "Wasser", note: "", cefr: null, status: "new", ease: 2.5, intervalDays: 0, dueAt: 0, reps: 0, lapses: 0, createdAt: 1, updatedAt: 1, deleted: false, pronunciation: "āb" };
    expect(cardSchema.parse(card).pronunciation).toBe("āb");
    const old = { ...card, pronunciation: undefined };
    expect(cardSchema.parse(old).pronunciation).toBeNull();
    const coll = { id: "coll-0000000009", kind: "media", mediaType: "song", title: "t", description: "", lang: "fa", level: null, visibility: "private", ownerName: "x", items: [{ lemma: "آب", lang: "fa", lexemeId: null, gloss: "Wasser", pronunciation: "āb", cefr: null }], createdAt: 1, updatedAt: 1, deleted: false };
    expect(collectionSchema.parse(coll).items[0].pronunciation).toBe("āb");
  });
});
