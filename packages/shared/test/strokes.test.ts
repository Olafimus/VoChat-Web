import { describe, expect, it } from "vitest";
import {
  applyGlyphAnswer,
  buildChoices,
  compareStroke,
  glyphId,
  glyphSchema,
  gradeAttempt,
  judgeStroke,
  pathToPoints,
  planGlyphSession,
  prepareGlyph,
  resample,
  strokeLength,
  updateDrift,
  type GlyphProgress,
  type Point,
} from "../src/index.js";

// Echte KanjiVG-Pfade
const JU = [
  "M11.88,50.98c3.18,0.89,6.62,0.61,9.87,0.35c19.92-1.58,45.23-4.76,63.38-5.82c3.85-0.23,7.23-0.07,11,0.56",
  "M52.22,11.63c1.4,1.4,2.2,3.96,2.2,6.26c0,1.13-0.03,51.22-0.19,73.41c-0.03,3.96-0.06,6.83-0.08,8.08",
];
const A = [
  "M31.01,33c0.88,0.88,2.75,1.82,5.25,1.75c8.62-0.25,20-2.12,29.5-4.25c1.51-0.34,4.62-0.88,6.62-0.5",
  "M49.76,17.62c0.88,1,1.82,3.26,1.38,5.25c-3.75,16.75-6.25,38.13-5.13,53.63c0.41,5.7,1.88,10.88,3.38,13.62",
  "M65.63,44.12c0.75,1.12,1.16,4.39,0.5,6.12c-4.62,12.26-11.24,23.76-25.37,35.76c-6.86,5.83-15.88,3.75-16.25-8.38c-0.34-10.87,13.38-23.12,32.38-26.74c12.42-2.37,27,1.38,30.5,12.75c4.05,13.18-3.76,26.37-20.88,30.49",
];

/** Simulierte Hand: Sollpfad mit Zittern, Versatz und wenigen, ungleichmäßigen Punkten. */
function hand(d: string, opts: { dx?: number; dy?: number; jitter?: number; reverse?: boolean; scale?: number; seed?: number } = {}): Point[] {
  let seed = opts.seed ?? 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const pts = resample(pathToPoints(d), 14).map((p) => ({
    x: 54.5 + (p.x - 54.5) * (opts.scale ?? 1) + (opts.dx ?? 0) + rnd() * (opts.jitter ?? 1.5),
    y: 54.5 + (p.y - 54.5) * (opts.scale ?? 1) + (opts.dy ?? 0) + rnd() * (opts.jitter ?? 1.5),
  }));
  return opts.reverse ? pts.reverse() : pts;
}

describe("pathToPoints", () => {
  it("liest absolute und relative Kurven", () => {
    const pts = pathToPoints(JU[0]!);
    expect(pts[0]).toEqual({ x: 11.88, y: 50.98 });
    const last = pts[pts.length - 1]!;
    expect(last.x).toBeCloseTo(96.13, 1);
    expect(last.y).toBeCloseTo(46.07, 1);
  });
  it("versteht Linien, H/V, S und zusammenhängende Zahlen", () => {
    const pts = pathToPoints("M0,0L10,0h5v5l-5-5");
    expect(pts.map((p) => [p.x, p.y])).toEqual([[0, 0], [10, 0], [15, 0], [15, 5], [10, 0]]);
    const s = pathToPoints("M0,0c10,0,20,0,30,0s20,0,30,0", 4);
    expect(s[s.length - 1]).toEqual({ x: 60, y: 0 });
  });
  it("resample liefert gleich weit entfernte Punkte", () => {
    const r = resample([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], 5);
    expect(r).toHaveLength(5);
    expect(strokeLength(r)).toBeCloseTo(20, 5);
    expect(r[2]).toEqual({ x: 10, y: 0 });
  });
});

describe("Strichvergleich", () => {
  const ju = prepareGlyph(JU);
  const a = prepareGlyph(A);

  it("erkennt ungenaue, aber richtige Striche", () => {
    for (let s = 1; s < 6; s++) {
      expect(judgeStroke(hand(JU[0]!, { jitter: 3, seed: s, dx: 4, dy: -3 }), ju, [0, 1]).verdict).toBe("ok");
      expect(judgeStroke(hand(A[2]!, { jitter: 3, seed: s, scale: 0.9 }), a, [2]).verdict).toBe("ok");
    }
  });

  it("genauer Strich bekommt eine hohe Punktzahl", () => {
    const precise = compareStroke(hand(JU[1]!, { jitter: 0.3 }), ju[1]!);
    const sloppy = compareStroke(hand(JU[1]!, { jitter: 4, dx: 6 }), ju[1]!);
    expect(precise.score).toBeGreaterThan(0.9);
    expect(sloppy.score).toBeLessThan(precise.score);
  });

  it("falsche Reihenfolge: senkrechter Strich vor dem waagerechten", () => {
    const r = judgeStroke(hand(JU[1]!), ju, [0, 1]);
    expect(r.verdict).toBe("order");
    expect(r.matched).toBe(1);
    expect(r.expected).toBe(0);
  });

  it("ohne erzwungene Reihenfolge zählt jeder offene Strich", () => {
    const r = judgeStroke(hand(JU[1]!), ju, [0, 1], { enforceOrder: false });
    expect(r.verdict).toBe("ok");
    expect(r.expected).toBe(1);
  });

  it("falsche Zugrichtung", () => {
    expect(judgeStroke(hand(JU[0]!, { reverse: true }), ju, [0, 1]).verdict).toBe("reversed");
    expect(judgeStroke(hand(JU[0]!, { reverse: true }), ju, [0, 1], { checkDirection: false }).verdict).toBe("ok");
  });

  it("weit daneben, zu kurz oder falsche Form zählt nicht", () => {
    expect(judgeStroke(hand(JU[0]!, { dy: 40 }), ju, [0, 1]).verdict).toBe("miss");
    const stub = hand(JU[0]!).slice(0, 3);
    const r = judgeStroke(stub, ju, [0, 1]);
    expect(r.verdict).toBe("miss");
    expect(r.message).toMatch(/kurz/);
    // Bogen von あ statt Querstrich
    expect(judgeStroke(hand(A[2]!), a, [0, 1, 2]).verdict).not.toBe("ok");
  });

  it("strenger Modus verlangt mehr Genauigkeit", () => {
    const input = hand(JU[0]!, { jitter: 4, dy: 16, seed: 3 });
    expect(judgeStroke(input, ju, [0, 1], { strictness: "relaxed" }).verdict).toBe("ok");
    expect(judgeStroke(input, ju, [0, 1], { strictness: "strict" }).verdict).toBe("miss");
  });

  it("Versatz wird teilweise ausgeglichen", () => {
    let drift = { x: 0, y: 0 };
    drift = updateDrift(drift, hand(JU[0]!, { dx: 10, dy: 10, jitter: 0 }), ju[0]!, 0);
    expect(drift.x).toBeCloseTo(5, 0);
    const shifted = hand(JU[1]!, { dx: 10, dy: 10 });
    expect(compareStroke(shifted, ju[1]!, "strict", drift).error).toBeLessThan(compareStroke(shifted, ju[1]!, "strict").error);
  });
});

describe("Bewertung eines Zeichens", () => {
  it("fehlerfrei und schnell ⇒ leicht, fehlerfrei ⇒ gut", () => {
    expect(gradeAttempt({ strokes: 4, mistakes: 0, hints: 0, accuracy: 0.9, responseMs: 3000 })).toBe("easy");
    expect(gradeAttempt({ strokes: 4, mistakes: 0, hints: 0, accuracy: 0.75, responseMs: 3000 })).toBe("good");
  });
  it("Fehler oder Hilfe ⇒ schwer, viele Fehler ⇒ nochmal", () => {
    expect(gradeAttempt({ strokes: 4, mistakes: 1, hints: 0, accuracy: 0.9, responseMs: null })).toBe("hard");
    expect(gradeAttempt({ strokes: 4, mistakes: 0, hints: 1, accuracy: 0.9, responseMs: null })).toBe("hard");
    expect(gradeAttempt({ strokes: 4, mistakes: 3, hints: 0, accuracy: 0.9, responseMs: null })).toBe("again");
    expect(gradeAttempt({ strokes: 12, mistakes: 4, hints: 0, accuracy: 0.9, responseMs: null })).toBe("hard");
  });
});

describe("Zeichen-Lernstand", () => {
  const now = Date.UTC(2026, 10, 2);
  const row = (char: string, write: GlyphProgress["write"]): GlyphProgress =>
    glyphSchema.parse({ id: glyphId("ja", char), lang: "ja", char, script: "kanji", write, createdAt: now, updatedAt: now, deleted: false });

  it("ID ist deterministisch", () => {
    expect(glyphId("ja", "あ")).toBe("g-ja-03042");
    expect(glyphSchema.safeParse(row("日", null)).success).toBe(true);
  });

  it("Gedächtnismodell: richtig verlängert, falsch kommt bald wieder", () => {
    const first = applyGlyphAnswer(null, "good", now, 0.9);
    expect(first.reps).toBe(1);
    expect(first.dueAt).toBeGreaterThan(now + 86_400_000);
    const lapse = applyGlyphAnswer(first, "again", first.dueAt, 0.9, "", 3);
    expect(lapse.lapses).toBe(1);
    expect(lapse.lastMistakes).toBe(3);
    expect(lapse.dueAt - first.dueAt).toBe(10 * 60 * 1000);
  });

  it("Lernblock: Falsches zuerst, dann Fälliges, dann Neues in Reihenfolge", () => {
    const due = applyGlyphAnswer(null, "good", now - 30 * 86_400_000, 0.9);
    const wrong = applyGlyphAnswer(null, "again", now - 3_600_000, 0.9);
    const later = applyGlyphAnswer(null, "easy", now, 0.9);
    const progress = new Map([
      ["一", row("一", due)],
      ["二", row("二", wrong)],
      ["三", row("三", later)],
    ]);
    const plan = planGlyphSession({ candidates: ["一", "二", "三", "四", "五", "六"], progress, skill: "write", now, newLimit: 2, size: 10 });
    expect(plan).toEqual([
      { char: "二", kind: "relearn" },
      { char: "一", kind: "review" },
      { char: "四", kind: "new" },
      { char: "五", kind: "new" },
    ]);
    // Andere Fertigkeit: alles neu
    expect(planGlyphSession({ candidates: ["一", "二"], progress, skill: "read", now, newLimit: 5, size: 10 }).every((p) => p.kind === "new")).toBe(true);
  });

  it("Antwortmöglichkeiten sind eindeutig und enthalten die richtige", () => {
    const pool = ["a", "i", "u", "e", "o", "ka"].map((r, i) => ({ c: String(i), strokes: 2, r }));
    const opts = buildChoices(pool[0]!, pool, (g) => g.r, 4, () => 0.3);
    expect(opts).toHaveLength(4);
    expect(new Set(opts).size).toBe(4);
    expect(opts).toContain("a");
  });
});
