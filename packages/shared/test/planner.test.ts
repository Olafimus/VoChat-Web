import { describe, expect, it } from "vitest";
import { DAY_MS } from "../src/memory.js";
import { buildPlan, DEFAULT_PLANNER, type PlannerCard } from "../src/planner.js";
import { computeStats } from "../src/stats.js";

const now = 100 * DAY_MS + 12 * 3600_000;
const today = 100 * DAY_MS;
const card = (id: string, p: Partial<PlannerCard> = {}): PlannerCard => ({
  id,
  status: "review",
  stability: 10,
  dueAt: now - 1,
  lastReviewAt: now - 10 * DAY_MS,
  createdAt: 0,
  lapses: 0,
  ...p,
});
const fresh = (id: string, p: Partial<PlannerCard> = {}) => card(id, { status: "new", stability: 0, lastReviewAt: null, dueAt: 0, ...p });

describe("planner", () => {
  it("puts relearning first, then the most forgotten reviews", () => {
    const plan = buildPlan(
      [
        card("ok", { lastReviewAt: now - 10 * DAY_MS }),
        card("worse", { lastReviewAt: now - 40 * DAY_MS }),
        card("relearn", { status: "learning", stability: 0.4, lastReviewAt: now - 15 * 60_000, dueAt: now - 5 * 60_000 }),
        card("future", { dueAt: now + DAY_MS }),
      ],
      [],
      DEFAULT_PLANNER,
      now,
      today,
    );
    expect(plan.items.map((i) => i.cardId)).toEqual(["relearn", "worse", "ok"]);
    expect(plan.items[1].reasons[0]).toMatch(/Erinnerung jetzt/);
    expect(plan.forecast[1]).toBe(1);
  });

  it("orders new words by importance and respects the daily limit", () => {
    const plan = buildPlan(
      [
        fresh("rare", { rank: 40000 }),
        fresh("common", { rank: 5, cefr: "A1" }),
        fresh("challenge", { rank: 3000, origin: "challenge:x" }),
        fresh("pinned", { rank: 45000, pinned: true }),
        fresh("ignored", { rank: 1, ignored: true }),
      ],
      [],
      { ...DEFAULT_PLANNER, newPerDay: 3, targetCefr: "A2", activeOrigins: ["challenge:x"] },
      now,
      today,
    );
    expect(plan.items.map((i) => i.cardId)).toEqual(["pinned", "common", "challenge"]);
    expect(plan.items.find((i) => i.cardId === "challenge")!.reasons).toContain("Teil einer laufenden Challenge");
    expect(plan.newAvailable).toBe(4);
  });

  it("counts new words already introduced today", () => {
    const plan = buildPlan(
      [fresh("a"), fresh("b"), card("c")],
      [{ cardId: "c", at: today + 1000 }, { cardId: "x", at: today + 2000 }],
      { ...DEFAULT_PLANNER, newPerDay: 2 },
      now,
      today,
    );
    expect(plan.newIntroducedToday).toBe(2); // c und x wurden heute zum ersten Mal beantwortet
    expect(plan.newAllowed).toBe(0);
  });

  it("holds back new words when reviews pile up", () => {
    const due = Array.from({ length: 20 }, (_, i) => card(`d${i}`));
    const plan = buildPlan([...due, fresh("n1"), fresh("n2")], [], { ...DEFAULT_PLANNER, maxReviewsPerDay: 20 }, now, today);
    expect(plan.newAllowed).toBe(0);
    expect(plan.notes[0]).toMatch(/Rückstand/);
  });

  it("mixes new cards between reviews", () => {
    const due = Array.from({ length: 6 }, (_, i) => card(`d${i}`));
    const plan = buildPlan([...due, fresh("n1"), fresh("n2")], [], DEFAULT_PLANNER, now, today);
    expect(plan.items[3].kind).toBe("new");
  });
});

describe("stats", () => {
  it("separates true retention from same-day answers and tracks streaks", () => {
    const d = (n: number) => today + n * DAY_MS;
    const cards = [{ id: "a", status: "review" as const, stability: 5, lastReviewAt: d(0) }];
    const reviews = [
      { cardId: "a", at: d(-3), grade: "good" as const },
      { cardId: "a", at: d(-1), grade: "again" as const },
      { cardId: "a", at: d(-1) + 5000, grade: "good" as const },
      { cardId: "a", at: d(0) + 3 * 3600_000, grade: "good" as const },
    ];
    const s = computeStats(cards, reviews, now, today);
    expect(s.retention).toEqual({ rate: 0.5, n: 2 });
    expect(s.sameDay).toEqual({ rate: 1, n: 1 });
    expect(s.streakDays).toBe(2);
    expect(s.today.reviews).toBe(1);
    expect(s.calibration.reduce((n, b) => n + b.n, 0)).toBe(2);
  });
});

import { computeInsights } from "../src/stats.js";
describe("insights", () => {
  it("builds heatmap, growth, stability buckets, hours and hardest words", () => {
    const today = 200 * DAY_MS;
    const cards = [
      { id: "a", lemma: "casa", status: "review" as const, stability: 12, lastReviewAt: today, lapses: 3, difficulty: 8, cefr: "A1" },
      { id: "b", lemma: "perro", status: "learning" as const, stability: 0.4, lastReviewAt: today, lapses: 0, difficulty: 5, cefr: "A1" },
      { id: "c", lemma: "nuevo", status: "new" as const, stability: 0, lastReviewAt: null, cefr: "A2" },
    ];
    const reviews = [
      { cardId: "a", at: today - 10 * DAY_MS + 3600_000, grade: "good" as const, responseMs: 4000 },
      { cardId: "a", at: today + 3600_000, grade: "again" as const, responseMs: 6000 },
      { cardId: "b", at: today + 7200_000, grade: "good" as const },
    ];
    const ins = computeInsights(cards, reviews, today, (t) => new Date(t).getUTCHours(), 30);
    expect(ins.heatmap).toHaveLength(30);
    expect(ins.heatmap.at(-1)!.reviews).toBe(2);
    expect(ins.heatmap.at(-11)!.reviews).toBe(1);
    expect(ins.growth.at(-1)!.total).toBe(2);
    expect(ins.growth.at(-12)!.total).toBe(0);
    expect(ins.stability.find((s) => s.label === "1–4 Wochen")!.count).toBe(1);
    expect(ins.stability.find((s) => s.label === "< 1 Tag")!.count).toBe(1);
    expect(ins.hours[1]).toEqual({ hour: 1, reviews: 2, correct: 1 });
    expect(ins.hardest.map((h) => h.lemma)).toEqual(["casa"]);
    expect(ins.levels).toEqual([{ level: "A1", known: 1, total: 2 }, { level: "A2", known: 0, total: 1 }]);
    expect(ins.avgResponseSec).toBe(5);
  });
});
