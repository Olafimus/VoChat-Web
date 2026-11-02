import { describe, expect, it } from "vitest";
import { goalProgress, goalSchema, GOAL_TEMPLATES, knownWords, streakDays, wordsPerDayHint, type Goal, type GoalCard, type GoalContext } from "../src/goals.js";

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1);
const dayStart = (t: number) => Math.floor(t / DAY) * DAY;

const card = (lemma: string, status: GoalCard["status"], extra: Partial<GoalCard> = {}): GoalCard => ({
  lemma, lang: "fa", status, deleted: false, createdAt: T0, lexemeId: null, ...extra,
});
const goal = (patch: Partial<Goal>): Goal =>
  goalSchema.parse({ id: "goal-000001", title: "Ziel", kind: "words_new", target: 10, startAt: T0, createdAt: T0, updatedAt: T0, deleted: false, ...patch });
const ctx = (patch: Partial<GoalContext> = {}): GoalContext => ({ cards: [], reviews: [], collections: [], now: T0 + 10 * DAY, dayStart, ...patch });

describe("goal progress", () => {
  it("counts each word once by lexeme id or language + word key", () => {
    const cards = [
      card("Haus", "review", { lang: "de" }),
      card("haus ", "mastered", { lang: "de" }),
      card("آب", "review", { lexemeId: 7 }),
      card("آب", "learning", { lexemeId: 7 }),
      card("نان", "new"),
      card("gone", "review", { deleted: true }),
    ];
    expect(knownWords(cards, null)).toBe(2);
    expect(knownWords(cards, "fa")).toBe(1);
  });

  it("measures new words against the baseline and judges the pace", () => {
    const cards = Array.from({ length: 6 }, (_, i) => card(`w${i}`, "review"));
    const g = goal({ kind: "words_new", target: 10, baseline: 2, deadline: T0 + 20 * DAY });
    const p = goalProgress(g, ctx({ cards }));
    expect(p).toMatchObject({ current: 4, target: 10, reached: false, daysLeft: 10 });
    expect(p.ratio).toBeCloseTo(0.4);
    expect(p.timeRatio).toBeCloseTo(0.5);
    expect(p.pace).toBe("on_track");
    expect(p.perDay).toBeCloseTo(6 / 11);
    expect(goalProgress(g, ctx({ cards: cards.slice(0, 3) })).pace).toBe("behind");
    expect(goalProgress(g, ctx({ cards, now: T0 + 21 * DAY })).pace).toBe("overdue");
    const more = Array.from({ length: 12 }, (_, i) => card(`x${i}`, "mastered"));
    expect(goalProgress(g, ctx({ cards: more })).pace).toBe("reached");
  });

  it("counts added words and reviews since the start, ignoring manual marks", () => {
    const g = goal({ kind: "words_added", target: 5, lang: "fa" });
    const cards = [card("a", "new", { createdAt: T0 - DAY }), card("b", "new", { createdAt: T0 + DAY }), card("c", "new", { createdAt: T0 + DAY, lang: "de" })];
    expect(goalProgress(g, ctx({ cards })).current).toBe(1);
    const r = goal({ kind: "reviews", target: 3 });
    const reviews = [{ at: T0 - 1 }, { at: T0 + 1 }, { at: T0 + 2, manual: true }, { at: T0 + 3 }, { at: T0 + 4, deleted: true }];
    expect(goalProgress(r, ctx({ reviews })).current).toBe(2);
  });

  it("computes streaks up to today or yesterday", () => {
    const now = T0 + 10 * DAY + 3600_000;
    const days = (...d: number[]) => d.map((n) => ({ at: T0 + n * DAY + 1000 }));
    expect(streakDays(days(8, 9, 10), now, dayStart)).toBe(3);
    expect(streakDays(days(7, 8, 9), now, dayStart)).toBe(3); // heute noch offen
    expect(streakDays(days(5, 6, 8), now, dayStart)).toBe(0);
    const g = goal({ kind: "streak", target: 7, deadline: T0 + 14 * DAY });
    expect(goalProgress(g, ctx({ reviews: days(8, 9, 10), now })).pace).toBe("on_track");
    expect(goalProgress(g, ctx({ reviews: [], now: T0 + 12 * DAY })).pace).toBe("behind");
  });

  it("tracks collection coverage and checklists", () => {
    const items = [{ lemma: "Haus", lang: "de" }, { lemma: "Hund", lang: "de" }, { lemma: "Katze", lang: "de" }, { lemma: "Maus", lang: "de" }];
    const g = goal({ kind: "collection", target: 50, collectionId: "col-1" });
    const cards = [card("haus", "review", { lang: "de" }), card("Hund", "mastered", { lang: "de" }), card("Katze", "learning", { lang: "de" })];
    expect(goalProgress(g, ctx({ cards, collections: [{ id: "col-1", title: "Tiere", items, deleted: false }] }))).toMatchObject({ current: 50, reached: true });
    expect(goalProgress(g, ctx({ cards })).missingCollection).toBe(true);
    const list = goal({ kind: "checklist", items: [{ id: "a", text: "eins", done: true }, { id: "b", text: "zwei", done: false }] });
    expect(goalProgress(list, ctx())).toMatchObject({ current: 1, target: 2, reached: false });
  });

  it("offers valid templates of every difficulty and rates the needed pace", () => {
    for (const t of GOAL_TEMPLATES) {
      expect(goalSchema.safeParse({ id: "goal-template", title: t.title, kind: t.kind, target: t.target, startAt: 0, createdAt: 0, updatedAt: 0, deleted: false, items: (t.items ?? []).map((text, i) => ({ id: String(i), text, done: false })) }).success).toBe(true);
    }
    expect(new Set(GOAL_TEMPLATES.map((t) => t.difficulty))).toEqual(new Set(["leicht", "mittel", "ambitioniert"]));
    expect(wordsPerDayHint(2).level).toBe("leicht");
    expect(wordsPerDayHint(30).text).toContain("mehr als 20");
  });
});
