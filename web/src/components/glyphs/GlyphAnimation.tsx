import { useMemo, useState } from "react";
import { GLYPH_SIZE, pathToPoints, strokeLength } from "@vochat/shared";
import { IconReset } from "../icons";

/**
 * Zeigt die Strichreihenfolge eines Zeichens: Striche erscheinen nacheinander in Zugrichtung,
 * Nummern am Anfangspunkt. Ohne Animation (oder bei reduzierter Bewegung) steht das fertige Zeichen da.
 */
export function GlyphAnimation({
  strokes,
  animate = true,
  numbers = true,
  speed = 1,
  size,
  label,
}: {
  strokes: string[];
  animate?: boolean;
  numbers?: boolean;
  /** 1 = etwa 0,45 s für einen mittellangen Strich. */
  speed?: number;
  size?: number | string;
  label?: string;
}) {
  const [run, setRun] = useState(0);
  const timeline = useMemo(() => {
    let t = 0.15;
    return strokes.map((d) => {
      const pts = pathToPoints(d);
      const len = strokeLength(pts);
      const dur = (0.18 + len / 160) / speed;
      const start = pts[0] ?? { x: 0, y: 0 };
      const next = pts[Math.min(3, pts.length - 1)] ?? start;
      // Nummer etwas vor den Anfangspunkt, entgegen der Zugrichtung
      const dx = start.x - next.x;
      const dy = start.y - next.y;
      const n = Math.hypot(dx, dy) || 1;
      const item = { d, delay: t, dur, nx: start.x + (dx / n) * 5, ny: start.y + (dy / n) * 5 };
      t += dur + 0.12 / speed;
      return item;
    });
  }, [strokes, speed]);

  return (
    <div className="glyph-anim" style={size ? { width: size } : undefined}>
      <svg viewBox={`0 0 ${GLYPH_SIZE} ${GLYPH_SIZE}`} role="img" aria-label={label ?? `Strichreihenfolge, ${strokes.length} Striche`} key={run}>
        <rect className="sb-frame" x="1" y="1" width={GLYPH_SIZE - 2} height={GLYPH_SIZE - 2} rx="6" />
        <path className="sb-grid" d={`M${GLYPH_SIZE / 2} 4V${GLYPH_SIZE - 4}M4 ${GLYPH_SIZE / 2}H${GLYPH_SIZE - 4}`} />
        {animate && strokes.map((d, i) => <path key={`o${i}`} d={d} className="sb-outline" />)}
        {timeline.map((s, i) => (
          <path
            key={i}
            d={s.d}
            pathLength={1}
            className={animate ? "ga-stroke" : "sb-done"}
            style={animate ? { animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` } : undefined}
          />
        ))}
        {numbers &&
          timeline.map((s, i) => (
            <text
              key={`n${i}`}
              x={s.nx}
              y={s.ny}
              className={`ga-num ${animate ? "ga-num-anim" : ""}`}
              style={animate ? { animationDelay: `${s.delay}s` } : undefined}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {i + 1}
            </text>
          ))}
      </svg>
      {animate && (
        <button className="ga-replay small-btn" onClick={() => setRun((r) => r + 1)} title="Noch einmal abspielen" aria-label="Noch einmal abspielen">
          <IconReset size={15} aria-hidden />
        </button>
      )}
    </div>
  );
}
