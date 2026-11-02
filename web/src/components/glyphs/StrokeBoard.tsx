import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import {
  GLYPH_SIZE,
  judgeStroke,
  prepareGlyph,
  strokeLength,
  updateDrift,
  type GlyphAttemptSummary,
  type Point,
  type Strictness,
  type StrokeResult,
} from "@vochat/shared";

export interface StrokeBoardHandle {
  /** Nächsten Strich vorführen (zählt als Hilfe). */
  hint(): void;
  /** Von vorn beginnen. */
  reset(): void;
}

export interface StrokeBoardSummary extends GlyphAttemptSummary {
  results: StrokeResult[];
}

export interface StrokeBoardProps {
  /** Strichmatrix: SVG-Pfade im Raster 0…109 in Sollreihenfolge. */
  strokes: string[];
  /** trace = Vorlage sichtbar, recall = aus dem Gedächtnis. */
  mode: "trace" | "recall";
  strictness?: Strictness;
  enforceOrder?: boolean;
  checkDirection?: boolean;
  /** Nach so vielen Fehlversuchen am selben Strich wird er automatisch gezeigt (0 = nie). */
  autoHintAfter?: number;
  /** Anfangspunkt des nächsten Strichs markieren (Standard: im Nachzeichnen-Modus). */
  showStart?: boolean;
  /** Strichnummern an erledigten Strichen. */
  showNumbers?: boolean;
  disabled?: boolean;
  label?: string;
  onStroke?: (result: StrokeResult) => void;
  onComplete?: (summary: StrokeBoardSummary) => void;
  ref?: Ref<StrokeBoardHandle>;
}

interface Flash {
  id: number;
  points: Point[];
  tone: "miss" | "order" | "reversed";
}

/** Strichnummer vor den Anfangspunkt setzen, entgegen der Zugrichtung (Striche mit gleichem Anfang überlappen nicht). */
function numberPos(points: Point[]): { x: number; y: number } {
  const a = points[0]!;
  const b = points[Math.min(2, points.length - 1)]!;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const n = Math.hypot(dx, dy) || 1;
  return { x: a.x + (dx / n) * 5, y: a.y + (dy / n) * 5 };
}

const toPolyline = (pts: Point[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

/**
 * Schreibfläche für ein Zeichen. Bekommt die Strichmatrix, nimmt Striche per Maus, Stift oder Finger
 * entgegen und vergleicht jeden Strich mit dem erwarteten (Form, Lage, Richtung, Reihenfolge – siehe
 * `judgeStroke`). Erkannte Striche werden in der Sollform eingeblendet, Fehlversuche kurz rot gezeigt.
 */
export function StrokeBoard({
  strokes,
  mode,
  strictness = "normal",
  enforceOrder = true,
  checkDirection = true,
  autoHintAfter = 2,
  showStart,
  showNumbers = false,
  disabled = false,
  label,
  onStroke,
  onComplete,
  ref,
}: StrokeBoardProps) {
  const glyph = useMemo(() => prepareGlyph(strokes), [strokes]);
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef<Point[] | null>(null);
  const startedAt = useRef(Date.now());
  const [live, setLive] = useState<Point[] | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [results, setResults] = useState<StrokeResult[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [hints, setHints] = useState(0);
  const [missesHere, setMissesHere] = useState(0);
  const [drift, setDrift] = useState<Point>({ x: 0, y: 0 });
  const [flash, setFlash] = useState<Flash | null>(null);
  const [hinting, setHinting] = useState<{ idx: number; key: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "bad" } | null>(null);

  const remaining = useMemo(() => glyph.map((_, i) => i).filter((i) => !done.includes(i)), [glyph, done]);
  const complete = remaining.length === 0 && glyph.length > 0;
  const expected = remaining[0];

  const reset = () => {
    setDone([]);
    setResults([]);
    setMistakes(0);
    setHints(0);
    setMissesHere(0);
    setDrift({ x: 0, y: 0 });
    setFlash(null);
    setHinting(null);
    setMessage(null);
    startedAt.current = Date.now();
  };

  // Neues Zeichen → frischer Zustand
  useEffect(reset, [glyph]);

  const showHint = (count: boolean) => {
    if (expected === undefined) return;
    if (count) setHints((h) => h + 1);
    setHinting({ idx: expected, key: Date.now() });
  };

  useImperativeHandle(ref, () => ({ hint: () => showHint(true), reset }), [expected]);

  const toPoint = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * GLYPH_SIZE, y: ((e.clientY - r.top) / r.height) * GLYPH_SIZE };
  };

  const finishStroke = (pts: Point[]) => {
    if (expected === undefined) return;
    // Versehentliches Antippen bei langen Strichen ignorieren
    if (strokeLength(pts) < 1.5 && glyph[expected]!.length > 22) return;
    const result = judgeStroke(pts, glyph, remaining, { strictness, enforceOrder, checkDirection, drift });
    onStroke?.(result);
    if (result.verdict === "ok") {
      const idx = result.expected;
      const nextDone = [...done, idx];
      const nextResults = [...results, result];
      setDrift((d) => updateDrift(d, pts, glyph[idx]!, done.length));
      setDone(nextDone);
      setResults(nextResults);
      setMissesHere(0);
      setHinting(null);
      setMessage({ text: result.message, tone: "ok" });
      if (nextDone.length === glyph.length) {
        const accuracy = nextResults.reduce((s, r) => s + r.comparison.score, 0) / nextResults.length;
        onComplete?.({ strokes: glyph.length, mistakes, hints, accuracy, responseMs: Date.now() - startedAt.current, results: nextResults });
      }
      return;
    }
    setMistakes((m) => m + 1);
    setFlash({ id: Date.now(), points: pts, tone: result.verdict === "order" ? "order" : result.verdict === "reversed" ? "reversed" : "miss" });
    setMessage({ text: result.message, tone: "bad" });
    const misses = missesHere + 1;
    setMissesHere(misses);
    if (autoHintAfter > 0 && misses >= autoHintAfter) {
      showHint(misses === autoHintAfter); // nur der erste automatische Hinweis je Strich zählt
    }
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled || complete || e.button > 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = [toPoint(e)];
    setLive(drawing.current);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === "function" ? e.nativeEvent.getCoalescedEvents() : [];
    for (const ev of events.length ? events : [e]) drawing.current.push(toPoint(ev));
    setLive([...drawing.current]);
  };
  const onPointerUp = () => {
    const pts = drawing.current;
    drawing.current = null;
    setLive(null);
    if (pts) finishStroke(pts);
  };

  const start = expected !== undefined ? glyph[expected]!.start : null;
  const markStart = showStart ?? mode === "trace";

  return (
    <div className={`stroke-board ${complete ? "is-complete" : ""}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`}
        className="sb-canvas"
        role="img"
        aria-label={label ?? "Schreibfläche"}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <rect className="sb-frame" x="1" y="1" width={GLYPH_SIZE - 2} height={GLYPH_SIZE - 2} rx="6" />
        <path className="sb-grid" d={`M${GLYPH_SIZE / 2} 4V${GLYPH_SIZE - 4}M4 ${GLYPH_SIZE / 2}H${GLYPH_SIZE - 4}`} />
        {mode === "trace" && strokes.map((d, i) => <path key={i} d={d} className="sb-outline" />)}
        {done.map((i) => (
          <path key={i} d={strokes[i]} className="sb-done" />
        ))}
        {showNumbers &&
          done.map((i, n) => (
            <text key={`n${i}`} {...numberPos(glyph[i]!.points)} className="sb-num" textAnchor="middle" dominantBaseline="central">
              {n + 1}
            </text>
          ))}
        {hinting && hinting.idx === expected && (
          <path key={hinting.key} d={strokes[hinting.idx]} pathLength={1} className="sb-hint" />
        )}
        {markStart && start && !complete && <circle cx={start.x} cy={start.y} r="3.2" className="sb-start" />}
        {flash && (
          <polyline key={flash.id} points={toPolyline(flash.points)} className={`sb-flash sb-flash-${flash.tone}`} onAnimationEnd={() => setFlash(null)} />
        )}
        {live && <polyline points={toPolyline(live)} className="sb-ink" />}
      </svg>
      <div className="sb-status small" aria-live="polite">
        <span>
          Strich {Math.min(done.length + 1, glyph.length)}/{glyph.length}
          {mistakes > 0 && <> · {mistakes} Fehler</>}
          {hints > 0 && <> · {hints} {hints === 1 ? "Hilfe" : "Hilfen"}</>}
        </span>
        {message && <span className={`sb-msg sb-msg-${message.tone}`}>{message.text}</span>}
      </div>
    </div>
  );
}
