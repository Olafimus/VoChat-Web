import { describe, expect, it } from "vitest";
import { isDue, newSchedule, reviewCard } from "../src/srs.js";

const DAY = 24 * 60 * 60 * 1000;

describe("reviewCard", () => {
  it("schedules a new card with good for one day, then three days", () => {
    const now = 1_000_000;
    const first = reviewCard(newSchedule(now), "good", now);
    expect(first.intervalDays).toBe(1);
    expect(first.dueAt).toBe(now + DAY);
    const second = reviewCard(first, "good", now);
    expect(second.intervalDays).toBe(3);
  });

  it("puts a forgotten card back into relearning within ten minutes", () => {
    const now = 0;
    const s = reviewCard({ ...newSchedule(now), reps: 4, intervalDays: 10, status: "review" }, "again", now);
    expect(s.status).toBe("learning");
    expect(s.dueAt).toBe(10 * 60 * 1000);
    expect(s.lapses).toBe(1);
    expect(s.ease).toBeCloseTo(2.3);
  });

  it("never lets ease fall below 1.3", () => {
    let s = newSchedule(0);
    for (let i = 0; i < 50; i++) s = reviewCard(s, "again", 0);
    expect(s.ease).toBe(1.3);
  });

  it("marks a card mastered once its interval reaches three weeks", () => {
    let s = newSchedule(0);
    for (let i = 0; i < 10; i++) s = reviewCard(s, "easy", 0);
    expect(s.status).toBe("mastered");
    expect(isDue(s, s.dueAt + 1)).toBe(false);
  });

  it("reports due cards correctly", () => {
    const s = newSchedule(100);
    expect(isDue(s, 100)).toBe(true);
    expect(isDue({ ...s, dueAt: 500 }, 400)).toBe(false);
  });
});
