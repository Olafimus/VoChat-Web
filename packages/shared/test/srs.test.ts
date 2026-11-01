import { describe, expect, it } from "vitest";
import { DAY_MS, initialState, intervalDays, nextState, replay, retrievability, RELEARN_MS, type Grade } from "../src/memory.js";
import { isDue, newSchedule, scheduleFromHistory } from "../src/srs.js";

const S = 1000; // Sekunde
const at = (days: number) => days * DAY_MS;

describe("memory model", () => {
  it("defines stability as the 90 % point", () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 5);
    expect(intervalDays(10, 0.9)).toBeCloseTo(10, 5);
    expect(intervalDays(10, 0.95)).toBeLessThan(10);
    expect(intervalDays(10, 0.8)).toBeGreaterThan(10);
    expect(retrievability(0, 3)).toBe(1);
  });

  it("orders initial stability by grade", () => {
    const s = (["again", "hard", "good", "easy"] as Grade[]).map((g) => initialState(g).stability);
    expect(s).toEqual([...s].sort((a, b) => a - b));
    expect(initialState("again").difficulty).toBeGreaterThan(initialState("easy").difficulty);
  });

  it("barely rewards a correct answer seconds after a mistake, but strongly after a week", () => {
    // Wort sitzt halbwegs (zweimal gut gelernt), dann ein Fehler …
    const base = [
      { at: at(0), grade: "good" as Grade },
      { at: at(3), grade: "good" as Grade },
      { at: at(12), grade: "again" as Grade },
    ];
    const quick = replay([...base, { at: at(12) + 5 * S, grade: "good" }]).steps.at(-1)!;
    expect(quick.gain!).toBeLessThan(1.05);
    expect(quick.quality).toBe("weak");

    // … gegenüber: dieselbe richtige Antwort nach einer Woche Pause (ohne Fehler)
    const later = replay([{ at: at(0), grade: "good" }, { at: at(3), grade: "good" }, { at: at(10), grade: "good" }]).steps.at(-1)!;
    expect(later.gain!).toBeGreaterThan(2);
    expect(later.quality).toBe("strong");
  });

  it("gives more credit the more time has passed (lower recall)", () => {
    const st = initialState("good");
    const gains = [5 * S, 1 * 3600 * S, 8 * 3600 * S, at(2), at(7), at(30)].map(
      (ms) => nextState(st, "good", ms / DAY_MS).stability,
    );
    for (let i = 1; i < gains.length; i++) expect(gains[i]).toBeGreaterThanOrEqual(gains[i - 1]);
  });

  it("shrinks stability on a lapse and ranks hard < good < easy", () => {
    const st = { stability: 20, difficulty: 5 };
    expect(nextState(st, "again", 20).stability).toBeLessThan(20);
    const [h, g, e] = (["hard", "good", "easy"] as Grade[]).map((gr) => nextState(st, gr, 20).stability);
    expect(h).toBeLessThan(g);
    expect(g).toBeLessThan(e);
  });

  it("makes difficult words harder after mistakes and easier after successes", () => {
    const st = { stability: 5, difficulty: 5 };
    expect(nextState(st, "again", 5).difficulty).toBeGreaterThan(5);
    expect(nextState(st, "easy", 5).difficulty).toBeLessThan(5);
  });

  it("replays history independent of input order and counts lapses", () => {
    const h = [
      { at: at(5), grade: "again" as Grade },
      { at: at(0), grade: "good" as Grade },
      { at: at(2), grade: "good" as Grade },
    ];
    const a = replay(h);
    const b = replay([...h].reverse());
    expect(a.state).toEqual(b.state);
    expect(a.lapses).toBe(1);
    expect(a.reps).toBe(3);
  });
});

describe("schedule", () => {
  it("keeps new cards new and due immediately", () => {
    const s = scheduleFromHistory([], { createdAt: 100 });
    expect(s).toEqual(newSchedule(100));
    expect(isDue(s, 200)).toBe(false); // neue Karten plant der Planer, nicht die Fälligkeit
  });

  it("relearns shortly after a mistake and spaces successes by stability", () => {
    const wrong = scheduleFromHistory([{ at: at(1), grade: "again" }], { createdAt: 0 });
    expect(wrong.dueAt).toBe(at(1) + RELEARN_MS);
    expect(wrong.status).toBe("learning");
    const good = scheduleFromHistory([{ at: 0, grade: "good" }], { createdAt: 0 });
    const s0 = initialState("good").stability;
    expect(good.intervalDays).toBeGreaterThanOrEqual(s0 * 0.95);
    expect(good.intervalDays).toBeLessThanOrEqual(s0 * 1.05);
    expect(good.status).toBe("review");
  });

  it("schedules higher target retention sooner", () => {
    const h = [{ at: 0, grade: "good" as Grade }, { at: at(3), grade: "good" as Grade }];
    const normal = scheduleFromHistory(h, { createdAt: 0, retention: 0.9 });
    const often = scheduleFromHistory(h, { createdAt: 0, retention: 0.95 });
    expect(often.dueAt).toBeLessThan(normal.dueAt);
  });

  it("marks well-established words as mastered", () => {
    const h = [0, 3, 12, 40, 120].map((d) => ({ at: at(d), grade: "good" as Grade }));
    expect(scheduleFromHistory(h, { createdAt: 0 }).status).toBe("mastered");
  });
});
