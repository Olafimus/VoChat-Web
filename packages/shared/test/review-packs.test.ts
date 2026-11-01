import { describe, expect, it } from "vitest";
import { accuracyFor } from "../src/review.js";
import { buildSmartPack } from "../src/packs.js";
import { coverage } from "../src/coverage.js";

const DAY = 24 * 60 * 60 * 1000;
const now = 100 * DAY;

describe("accuracyFor", () => {
  it("computes the rate inside the time window only", () => {
    const events = [
      { cardId: "a", outcome: "right" as const, mode: "type" as const, at: now - 1000 },
      { cardId: "a", outcome: "wrong" as const, mode: "type" as const, at: now - 2000 },
      { cardId: "a", outcome: "wrong" as const, mode: "type" as const, at: now - 30 * DAY },
    ];
    const acc = accuracyFor(events, "a", now, 7 * DAY);
    expect(acc.right).toBe(1);
    expect(acc.wrong).toBe(1);
    expect(acc.rate).toBe(0.5);
  });
});

describe("buildSmartPack", () => {
  const base = { dueAt: now - DAY, createdAt: 0, lapses: 0 };
  const cards = [
    { ...base, id: "weak", status: "review" as const },
    { ...base, id: "due", status: "review" as const },
    { ...base, id: "new1", status: "new" as const, dueAt: now },
    { ...base, id: "new2", status: "new" as const, dueAt: now },
    { ...base, id: "mastered", status: "mastered" as const },
  ];

  it("puts weak cards first and skips mastered ones", () => {
    const events = [
      { cardId: "weak", outcome: "wrong" as const, mode: "type" as const, at: now - 2 * DAY },
      { cardId: "weak", outcome: "wrong" as const, mode: "type" as const, at: now - DAY },
      { cardId: "weak", outcome: "right" as const, mode: "type" as const, at: now - 3 * DAY },
    ];
    const pack = buildSmartPack(cards, events, { now });
    expect(pack[0].cardId).toBe("weak");
    expect(pack[0].reason).toBe("schwach");
    expect(pack.map((p) => p.cardId)).not.toContain("mastered");
  });

  it("reinserts a card answered wrong after the waiting time", () => {
    const events = [{ cardId: "due", outcome: "wrong" as const, mode: "flip" as const, at: now - 20 * 60 * 1000 }];
    const pack = buildSmartPack(cards, events, { now, reinsertAfterMs: 10 * 60 * 1000 });
    const item = pack.find((p) => p.cardId === "due");
    expect(item?.reason).toBe("wiederholen");
  });

  it("limits new cards per pack", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, status: "new" as const, dueAt: now, createdAt: 0, lapses: 0 }));
    const pack = buildSmartPack(many, [], { now, maxNew: 3 });
    expect(pack).toHaveLength(3);
  });
});

describe("coverage", () => {
  it("separates known, learning and missing words", () => {
    const items = [
      { lemma: "Haus", lang: "de" },
      { lemma: "Hund", lang: "de" },
      { lemma: "Katze", lang: "de" },
      { lemma: "Haus", lang: "de" },
    ];
    const cards = [
      { lemma: "haus", lang: "de", status: "review" as const, deleted: false },
      { lemma: "Hund", lang: "de", status: "learning" as const, deleted: false },
    ];
    const c = coverage(items, cards);
    expect(c.total).toBe(3);
    expect(c.known).toBe(1);
    expect(c.learning).toBe(1);
    expect(c.missing.map((m) => m.lemma)).toEqual(["Katze"]);
    expect(c.ratio).toBeCloseTo(1 / 3);
  });
});

describe("coverage with references", () => {
  it("matches by lexeme id even when the user edited the spelling", () => {
    const items = [{ lemma: "Haus", lang: "de", lexemeId: 7 }];
    const cards = [{ lemma: "Häuschen (mein Wort)", lang: "de", lexemeId: 7, status: "review" as const, deleted: false }];
    expect(coverage(items, cards).known).toBe(1);
  });

  it("matches unlinked words by normalized spelling, including Persian letter variants", () => {
    const items = [{ lemma: "کتاب", lang: "fa", lexemeId: null }];
    const cards = [{ lemma: "كتاب", lang: "fa", lexemeId: null, status: "learning" as const, deleted: false }];
    const c = coverage(items, cards);
    expect(c.learning).toBe(1);
    expect(c.missing).toHaveLength(0);
  });
});

describe("reinsert only while the last answer is wrong", () => {
  it("stops reinserting a card once it was answered correctly", () => {
    const card = { id: "c", status: "review" as const, dueAt: now + DAY, createdAt: 0, lapses: 0 };
    const events = [
      { cardId: "c", outcome: "wrong" as const, mode: "type" as const, at: now - 2 * 60 * 60 * 1000 },
      { cardId: "c", outcome: "right" as const, mode: "type" as const, at: now - 60 * 60 * 1000 },
      { cardId: "c", outcome: "right" as const, mode: "type" as const, at: now - 30 * 60 * 1000 },
      { cardId: "c", outcome: "right" as const, mode: "type" as const, at: now - 20 * 60 * 1000 },
    ];
    // 3 von 4 richtig (75 %) ist nicht schwach; nach den richtigen Antworten gibt es nichts nachzuholen.
    expect(buildSmartPack([card], events, { now })).toEqual([]);
  });
});
