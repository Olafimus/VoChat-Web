/**
 * Strichvergleich für das Schreiben von Zeichen (Kana, Kanji, später weitere Schriften).
 *
 * Ein Zeichen ist eine geordnete Liste von Strichen ("Strichmatrix"), jeder Strich ein SVG-Pfad im
 * Raster 0…109 (KanjiVG). Eine Eingabe mit Maus, Stift oder Finger ist eine Punktfolge im selben Raster.
 *
 * Vergleich eines gezogenen Strichs mit einem Sollstrich:
 *  1. Beide werden auf gleich viele, gleich weit auseinanderliegende Punkte gebracht (Resampling).
 *  2. Lage-Abstand: mittlerer Abstand der einander entsprechenden Punkte (wo liegt der Strich?).
 *  3. Form-Abstand: derselbe Abstand, nachdem beide Striche auf ihren Schwerpunkt verschoben wurden
 *     (stimmt die Form, auch wenn der Strich etwas versetzt ist?).
 *  4. Richtung: derselbe Vergleich mit umgedrehter Eingabe – ist der deutlich besser, wurde der Strich
 *     falsch herum gezogen.
 *  5. Länge: grob zu kurze oder zu lange Striche fallen durch.
 * Jeder Abstand wird durch eine Toleranz geteilt (je nach Strenge). Der größte normierte Fehler `error`
 * entscheidet: ≤ 1 gilt als getroffen. `score` = 1 − error/2 (getroffen ⇒ 0,5…1).
 *
 * Reihenfolge: Die Eingabe wird zusätzlich mit allen noch offenen Strichen verglichen. Passt sie klar
 * besser zu einem späteren Strich, war die Reihenfolge falsch.
 *
 * Versatz: Wer das ganze Zeichen etwas verschoben schreibt, wird nicht bei jedem Strich bestraft – der
 * mittlere Versatz der bereits erkannten Striche wird zur Hälfte ausgeglichen (`drift`).
 *
 * Reine Funktionen ohne DOM: in Tests, im Browser und auf dem Server nutzbar.
 */

export interface Point {
  x: number;
  y: number;
}

/** Kantenlänge des Rasters (KanjiVG: 109 × 109). */
export const GLYPH_SIZE = 109;

export type Strictness = "relaxed" | "normal" | "strict";

/** Toleranzen in Rastereinheiten (Zeichen = 109). */
export const STRICTNESS: Record<Strictness, { shape: number; position: number; length: [number, number] }> = {
  relaxed: { shape: 17, position: 24, length: [0.35, 2.4] },
  normal: { shape: 13, position: 19, length: [0.45, 2] },
  strict: { shape: 9.5, position: 14, length: [0.55, 1.7] },
};

const RESAMPLE = 32;

// ---------- SVG-Pfad → Punktfolge ----------

/** SVG-Pfad (M, L, H, V, C, S, Q, T, Z – groß und klein) in eine Polylinie umrechnen. */
export function pathToPoints(d: string, samplesPerCurve = 12): Point[] {
  const tokens = d.match(/[a-df-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  const points: Point[] = [];
  let i = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let lastCtrl: Point | null = null;
  let lastQuad: Point | null = null;
  const num = () => Number(tokens[i++]);
  const isNum = () => i < tokens.length && /^[-.\d]/.test(tokens[i]!);
  const push = (x: number, y: number) => points.push({ x, y });
  const cubic = (p0: Point, p1: Point, p2: Point, p3: Point) => {
    for (let s = 1; s <= samplesPerCurve; s++) {
      const t = s / samplesPerCurve;
      const u = 1 - t;
      push(
        u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
        u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
      );
    }
  };

  while (i < tokens.length) {
    if (!isNum()) cmd = tokens[i++]!;
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    switch (cmd.toUpperCase()) {
      case "M": {
        cx = ox + num();
        cy = oy + num();
        startX = cx;
        startY = cy;
        push(cx, cy);
        cmd = rel ? "l" : "L"; // weitere Zahlenpaare nach M sind Linien
        lastCtrl = lastQuad = null;
        break;
      }
      case "L":
        cx = ox + num();
        cy = oy + num();
        push(cx, cy);
        lastCtrl = lastQuad = null;
        break;
      case "H":
        cx = ox + num();
        push(cx, cy);
        lastCtrl = lastQuad = null;
        break;
      case "V":
        cy = oy + num();
        push(cx, cy);
        lastCtrl = lastQuad = null;
        break;
      case "C": {
        const p1 = { x: ox + num(), y: oy + num() };
        const p2 = { x: ox + num(), y: oy + num() };
        const p3 = { x: ox + num(), y: oy + num() };
        cubic({ x: cx, y: cy }, p1, p2, p3);
        lastCtrl = p2;
        lastQuad = null;
        cx = p3.x;
        cy = p3.y;
        break;
      }
      case "S": {
        const p1 = lastCtrl ? { x: 2 * cx - lastCtrl.x, y: 2 * cy - lastCtrl.y } : { x: cx, y: cy };
        const p2 = { x: ox + num(), y: oy + num() };
        const p3 = { x: ox + num(), y: oy + num() };
        cubic({ x: cx, y: cy }, p1, p2, p3);
        lastCtrl = p2;
        lastQuad = null;
        cx = p3.x;
        cy = p3.y;
        break;
      }
      case "Q":
      case "T": {
        const q: Point =
          cmd.toUpperCase() === "Q"
            ? { x: ox + num(), y: oy + num() }
            : lastQuad
              ? { x: 2 * cx - lastQuad.x, y: 2 * cy - lastQuad.y }
              : { x: cx, y: cy };
        const p3 = { x: ox + num(), y: oy + num() };
        const p0 = { x: cx, y: cy };
        // Quadratische Kurve als kubische darstellen
        cubic(p0, { x: p0.x + (2 / 3) * (q.x - p0.x), y: p0.y + (2 / 3) * (q.y - p0.y) }, { x: p3.x + (2 / 3) * (q.x - p3.x), y: p3.y + (2 / 3) * (q.y - p3.y) }, p3);
        lastQuad = q;
        lastCtrl = null;
        cx = p3.x;
        cy = p3.y;
        break;
      }
      case "Z":
        cx = startX;
        cy = startY;
        push(cx, cy);
        lastCtrl = lastQuad = null;
        break;
      default:
        // unbekannter Befehl (z. B. Bogen) – Rest überspringen
        return points;
    }
  }
  return points;
}

// ---------- Geometrie ----------

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function strokeLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += dist(points[i - 1]!, points[i]!);
  return len;
}

/** Auf `n` gleich weit auseinanderliegende Punkte bringen. Ein einzelner Punkt wird vervielfacht. */
export function resample(points: Point[], n = RESAMPLE): Point[] {
  if (points.length === 0) return [];
  const total = strokeLength(points);
  if (points.length === 1 || total === 0) return Array.from({ length: n }, () => ({ ...points[0]! }));
  const step = total / (n - 1);
  const out: Point[] = [{ ...points[0]! }];
  let acc = 0;
  let prev = points[0]!;
  for (let i = 1; i < points.length && out.length < n; i++) {
    let cur = points[i]!;
    let seg = dist(prev, cur);
    while (seg > 0 && acc + seg >= step && out.length < n) {
      const t = (step - acc) / seg;
      const q: Point = { x: prev.x + t * (cur.x - prev.x), y: prev.y + t * (cur.y - prev.y) };
      out.push(q);
      prev = q;
      seg = dist(prev, cur);
      acc = 0;
    }
    acc += seg;
    prev = cur;
  }
  while (out.length < n) out.push({ ...points[points.length - 1]! });
  return out;
}

export function centroid(points: Point[]): Point {
  const n = points.length || 1;
  return { x: points.reduce((s, p) => s + p.x, 0) / n, y: points.reduce((s, p) => s + p.y, 0) / n };
}

/** Gleitender Mittelwert über drei Punkte (Endpunkte bleiben). */
export function smooth(points: Point[]): Point[] {
  if (points.length < 3) return points;
  return points.map((p, i) =>
    i === 0 || i === points.length - 1
      ? p
      : { x: (points[i - 1]!.x + p.x + points[i + 1]!.x) / 3, y: (points[i - 1]!.y + p.y + points[i + 1]!.y) / 3 },
  );
}

const meanDistance = (a: Point[], b: Point[]) => a.reduce((s, p, i) => s + dist(p, b[i]!), 0) / a.length;

function shift(points: Point[], dx: number, dy: number): Point[] {
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

// ---------- Vergleich ----------

/** Vorbereiteter Sollstrich (einmal berechnen, oft vergleichen). */
export interface RefStroke {
  points: Point[];
  length: number;
  start: Point;
  end: Point;
  center: Point;
}

export function prepareStroke(d: string): RefStroke {
  const raw = pathToPoints(d);
  const points = resample(raw);
  return { points, length: strokeLength(raw), start: points[0]!, end: points[points.length - 1]!, center: centroid(points) };
}

export function prepareGlyph(paths: string[]): RefStroke[] {
  return paths.map(prepareStroke);
}

export interface StrokeComparison {
  /** Normierter Fehler: ≤ 1 = getroffen. */
  error: number;
  /** 0…1, getroffen ⇒ ≥ 0,5. */
  score: number;
  /** Lage, Form, Länge einzeln (normiert, ≤ 1 = in Ordnung). */
  position: number;
  shape: number;
  length: number;
  /** Eingabe passt umgedreht deutlich besser: falsche Zugrichtung. */
  reversed: boolean;
}

export function compareStroke(input: Point[], ref: RefStroke, strictness: Strictness = "normal", drift: Point = { x: 0, y: 0 }): StrokeComparison {
  const tol = STRICTNESS[strictness];
  const corrected = shift(input, -drift.x, -drift.y);
  const pts = resample(corrected);
  // Länge der geglätteten Eingabe: Zittern von Finger oder Maus soll den Strich nicht „verlängern“.
  const len = strokeLength(smooth(resample(corrected, 24)));
  const rev = [...pts].reverse();

  // Kurze Striche (Punkte, Häkchen): Zugrichtung und Form sind kaum messbar – mehr Spielraum.
  const short = ref.length < 22;
  const shapeTol = short ? tol.shape * 1.4 : tol.shape;
  const posTol = short ? tol.position * 1.15 : tol.position;

  const fwdPos = meanDistance(pts, ref.points);
  const revPos = meanDistance(rev, ref.points);
  const c = centroid(pts);
  const centeredRef = shift(ref.points, -ref.center.x, -ref.center.y);
  const fwdShape = meanDistance(shift(pts, -c.x, -c.y), centeredRef);
  const revShape = meanDistance(shift(rev, -c.x, -c.y), centeredRef);

  const reversed = !short && revShape + revPos < 0.6 * (fwdShape + fwdPos) && revShape <= shapeTol;
  const posErr = (reversed ? revPos : fwdPos) / posTol;
  const shapeErr = (reversed ? revShape : fwdShape) / shapeTol;

  const ratio = ref.length > 0 ? len / ref.length : 1;
  const [lo, hi] = tol.length;
  // Sehr kurze Sollstriche: absolute Mindestlänge statt Verhältnis (ein Tippen auf einen Punkt zählt).
  const lengthErr = short ? (len > ref.length * hi + 12 ? (len - 12) / (ref.length * hi) : 0) : ratio < lo ? lo / Math.max(ratio, 0.01) : ratio > hi ? ratio / hi : 0;

  const error = Math.max(posErr, shapeErr, lengthErr);
  const score = Math.max(0, Math.min(1, 1 - error / 2));
  return { error, score, position: posErr, shape: shapeErr, length: lengthErr, reversed };
}

export type StrokeVerdict =
  /** richtig (Form, Lage, Richtung, Reihenfolge) */
  | "ok"
  /** richtiger Strich, aber falsch herum gezogen */
  | "reversed"
  /** passt zu einem anderen, noch offenen Strich */
  | "order"
  /** passt zu keinem Strich */
  | "miss";

export interface StrokeResult {
  verdict: StrokeVerdict;
  /** Index des erwarteten Strichs. */
  expected: number;
  /** Index des am besten passenden offenen Strichs (bei "order" ≠ expected), sonst null. */
  matched: number | null;
  comparison: StrokeComparison;
  /** Kurzer Hinweis für die Anzeige. */
  message: string;
}

export interface JudgeOptions {
  strictness?: Strictness;
  /** Falsche Zugrichtung zählt als Fehler (Standard: ja). */
  checkDirection?: boolean;
  /** Reihenfolge erzwingen (Standard: ja). Ohne: jeder offene Strich darf als nächster kommen. */
  enforceOrder?: boolean;
  drift?: Point;
}

/**
 * Beurteilt einen gezogenen Strich gegen den nächsten erwarteten Strich.
 * `remaining`: Indizes der noch offenen Striche in Sollreihenfolge (der erste ist der erwartete).
 */
export function judgeStroke(input: Point[], glyph: RefStroke[], remaining: number[], options: JudgeOptions = {}): StrokeResult {
  const strictness = options.strictness ?? "normal";
  const checkDirection = options.checkDirection ?? true;
  const enforceOrder = options.enforceOrder ?? true;
  const expected = remaining[0]!;
  const results = remaining.map((idx) => ({ idx, cmp: compareStroke(input, glyph[idx]!, strictness, options.drift) }));
  const own = results[0]!;
  const best = results.reduce((a, b) => (b.cmp.error < a.cmp.error ? b : a));

  const fits = (r: { cmp: StrokeComparison }) => r.cmp.error <= 1;

  if (!enforceOrder && fits(best) && best.idx !== expected) {
    const ok = !best.cmp.reversed || !checkDirection;
    return { verdict: ok ? "ok" : "reversed", expected: best.idx, matched: best.idx, comparison: best.cmp, message: ok ? "Gut!" : "Richtung andersherum" };
  }
  // Ein anderer offener Strich passt klar besser → Reihenfolge falsch.
  // Passt der erwartete Strich gerade noch, zählt er – außer ein anderer passt fast perfekt und er selbst nur knapp.
  if (best.idx !== expected && fits(best) && (!fits(own) || (own.cmp.error > 0.3 && best.cmp.error < own.cmp.error * 0.5))) {
    return {
      verdict: "order",
      expected,
      matched: best.idx,
      comparison: own.cmp,
      message: `Reihenfolge: Das wäre Strich ${best.idx + 1} – dran ist Strich ${expected + 1}`,
    };
  }
  if (fits(own)) {
    if (own.cmp.reversed && checkDirection) return { verdict: "reversed", expected, matched: expected, comparison: own.cmp, message: "Richtiger Strich, aber falsch herum gezogen" };
    return { verdict: "ok", expected, matched: expected, comparison: own.cmp, message: own.cmp.score > 0.85 ? "Sehr genau!" : own.cmp.score > 0.7 ? "Gut!" : "Knapp, aber zählt" };
  }
  const c = own.cmp;
  const message =
    c.length > 1 && c.length >= c.shape && c.length >= c.position
      ? (strokeLength(input) < glyph[expected]!.length ? "Strich zu kurz" : "Strich zu lang")
      : c.position > c.shape
        ? "Form passt, aber an der falschen Stelle"
        : "Form passt nicht";
  return { verdict: "miss", expected, matched: null, comparison: c, message };
}

/** Mittlerer Versatz der Eingabe gegenüber dem Soll – zur Hälfte ausgeglichen, auf ±12 begrenzt. */
export function updateDrift(drift: Point, input: Point[], ref: RefStroke, count: number): Point {
  const c = centroid(resample(input));
  const dx = c.x - ref.center.x;
  const dy = c.y - ref.center.y;
  const n = count + 1;
  const clamp = (v: number) => Math.max(-12, Math.min(12, v));
  return { x: clamp(drift.x + (dx * 0.5 - drift.x) / n), y: clamp(drift.y + (dy * 0.5 - drift.y) / n) };
}

// ---------- Ganzes Zeichen ----------

export interface GlyphAttemptSummary {
  strokes: number;
  /** Fehlversuche (falsche Striche, Reihenfolge, Richtung). */
  mistakes: number;
  /** Wie oft ein Hinweis angefordert oder automatisch gezeigt wurde. */
  hints: number;
  /** Mittlere Genauigkeit der erkannten Striche (0…1). */
  accuracy: number;
  responseMs: number | null;
}

export type GlyphGrade = "again" | "hard" | "good" | "easy";

/**
 * Bewertung für das Gedächtnismodell: fehlerfrei und genau ⇒ gut/leicht, wenige Fehler ⇒ schwer,
 * viele Fehler oder Hilfe bei mehr als einem Strich ⇒ nochmal.
 */
export function gradeAttempt(a: GlyphAttemptSummary): GlyphGrade {
  const allowed = Math.max(1, Math.floor(a.strokes / 5));
  if (a.mistakes > allowed * 2 || a.hints > 1) return "again";
  if (a.mistakes > 0 || a.hints > 0 || a.accuracy < 0.6) return "hard";
  const fast = a.responseMs !== null && a.responseMs < 1500 + a.strokes * 900;
  return a.accuracy >= 0.82 && fast ? "easy" : "good";
}
