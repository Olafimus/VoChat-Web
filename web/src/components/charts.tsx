import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/**
 * Kleine, abhängigkeitsfreie Diagramme für die Statistik. Eine Farbe je Diagramm (Akzent),
 * zurückhaltende Achsen, Tooltip beim Überfahren/Antippen, Werte zusätzlich als Text (aria-label).
 */

function useTip() {
  const [tip, setTip] = useState<{ x: number; y: number; text: ReactNode } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const show = (e: { clientX: number; clientY: number }, text: ReactNode) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setTip({ x: e.clientX - r.left, y: e.clientY - r.top, text });
  };
  const node = tip && (
    <div className="chart-tip" style={{ left: tip.x, top: tip.y }} role="status">
      {tip.text}
    </div>
  );
  return { box, show, hide: () => setTip(null), node };
}

export function BarChart({
  data,
  height = 140,
  label,
  format = (n) => String(n),
  highlight,
}: {
  data: { label: string; value: number; tip?: string }[];
  height?: number;
  label: string;
  format?: (n: number) => string;
  highlight?: number;
}) {
  const t = useTip();
  const max = Math.max(1, ...data.map((d) => d.value));
  const showEvery = data.length > 16 ? Math.ceil(data.length / 8) : 1;
  return (
    <div className="chart" ref={t.box} onMouseLeave={t.hide}>
      <div className="vbars" style={{ height }} role="img" aria-label={`${label}: ${data.map((d) => `${d.label} ${format(d.value)}`).join(", ")}`}>
        {data.map((d, i) => (
          <div
            key={i}
            className={`vbar-col ${highlight === i ? "hl" : ""}`}
            onMouseMove={(e) => t.show(e, <><b>{d.tip ?? d.label}</b>: {format(d.value)}</>)}
            onClick={(e) => t.show(e, <><b>{d.tip ?? d.label}</b>: {format(d.value)}</>)}
          >
            <span className="vbar" style={{ height: `${(d.value / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <div className="vbar-labels" aria-hidden>
        {data.map((d, i) => (
          <span key={i}>{i % showEvery === 0 ? d.label : ""}</span>
        ))}
      </div>
      {t.node}
    </div>
  );
}

const HM_DAY = new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "numeric", month: "short" });
const HM_MONTH = new Intl.DateTimeFormat("de-DE", { month: "short" });

/** Kalender-Heatmap: Spalten = Wochen (Mo–So), Farbe = Anzahl Antworten (fünf Stufen einer Farbe). */
export function Heatmap({ days: allDays }: { days: { day: number; reviews: number }[] }) {
  const t = useTip();
  // Nur so viele Wochen, wie in die Breite passen (Zelle 13 px + 3 px Abstand)
  // So viele Wochen wie passen (Zellen 11–18 px), Zellgröße füllt die Breite
  const [layout, setLayout] = useState({ weeks: 26, cell: 13 });
  useEffect(() => {
    const el = t.box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width;
      const weeks = Math.max(8, Math.min(Math.ceil(allDays.length / 7), Math.floor((w + 3) / 14)));
      const cell = Math.max(10, Math.min(18, Math.floor((w - (weeks - 1) * 3) / weeks)));
      setLayout((prev) => (prev.weeks === weeks - 1 && prev.cell === cell ? prev : { weeks: weeks - 1, cell }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [t.box, allDays.length]);
  const days = useMemo(() => allDays.slice(-Math.min(allDays.length, layout.weeks * 7)), [allDays, layout.weeks]);
  const { weeks, months, steps } = useMemo(() => {
    const max = Math.max(1, ...days.map((d) => d.reviews));
    const steps = [0, Math.ceil(max * 0.25), Math.ceil(max * 0.5), Math.ceil(max * 0.75)];
    const level = (n: number) => (n === 0 ? 0 : n <= steps[1] ? 1 : n <= steps[2] ? 2 : n <= steps[3] ? 3 : 4);
    const first = new Date(days[0].day);
    const pad = (first.getDay() + 6) % 7; // Montag = 0
    const cells: ({ day: number; reviews: number; level: number } | null)[] = [...Array(pad).fill(null), ...days.map((d) => ({ ...d, level: level(d.reviews) }))];
    const weeks: (typeof cells)[] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    let lastLabel = -3;
    const months = weeks.map((w, i) => {
      const firstDay = w.find(Boolean);
      const prev = weeks[i - 1]?.find(Boolean);
      const starts = firstDay && prev && new Date(prev.day).getMonth() !== new Date(firstDay.day).getMonth();
      if (!starts || i - lastLabel < 3) return ""; // Abstand halten, damit sich Monatsnamen nicht überlappen
      lastLabel = i;
      return HM_MONTH.format(firstDay!.day);
    });
    return { weeks, months, steps };
  }, [days]);
  const total = days.reduce((n, d) => n + d.reviews, 0);
  const active = days.filter((d) => d.reviews > 0).length;
  return (
    <div className="chart" ref={t.box} onMouseLeave={t.hide}>
      <div className="heatmap-scroll">
        <div className="heatmap" style={{ ["--cell" as string]: `${layout.cell}px` }} role="img" aria-label={`${total} Antworten an ${active} von ${days.length} Tagen`}>
          <div className="hm-months" aria-hidden>
            {months.map((m, i) => (
              <span key={i}>{m}</span>
            ))}
          </div>
          <div className="hm-grid">
            {weeks.map((w, i) => (
              <div key={i} className="hm-week">
                {Array.from({ length: 7 }, (_, j) => {
                  const c = w[j];
                  return c ? (
                    <span
                      key={j}
                      className={`hm-cell hm-${c.level}`}
                      onMouseMove={(e) => t.show(e, <><b>{HM_DAY.format(c.day)}</b>: {c.reviews} Antworten</>)}
                      onClick={(e) => t.show(e, <><b>{HM_DAY.format(c.day)}</b>: {c.reviews} Antworten</>)}
                    />
                  ) : (
                    <span key={j} className="hm-cell hm-empty" />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="hm-legend muted small">
        weniger
        {[0, 1, 2, 3, 4].map((l) => (
          <span key={l} className={`hm-cell hm-${l}`} title={l === 0 ? "0" : `bis ${steps[l] ?? "mehr"}`} />
        ))}
        mehr · {active} aktive Tage
      </div>
      {t.node}
    </div>
  );
}

const DATE = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "short" });

/** Flächendiagramm mit Fadenkreuz: z. B. Wachstum des Wortschatzes. */
export function AreaChart({ points, label, unit }: { points: { day: number; total: number }[]; label: string; unit: string }) {
  const t = useTip();
  const [hover, setHover] = useState<number | null>(null);
  // Breite messen, damit Achsentexte in echter Größe erscheinen (nicht mitskaliert)
  const [W, setW] = useState(600);
  useEffect(() => {
    const el = t.box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [t.box]);
  const H = 180;
  const P = { l: 34, r: 8, t: 10, b: 22 };
  const max = Math.max(1, ...points.map((p) => p.total));
  const nice = Math.ceil(max / 5) * 5 || 5;
  const x = (i: number) => P.l + (i / Math.max(1, points.length - 1)) * (W - P.l - P.r);
  const y = (v: number) => P.t + (1 - v / nice) * (H - P.t - P.b);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const ticks = [0, nice / 2, nice];
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - r.left) / r.width) * W;
    const i = Math.max(0, Math.min(points.length - 1, Math.round(((rel - P.l) / (W - P.l - P.r)) * (points.length - 1))));
    setHover(i);
    t.show(e, <><b>{DATE.format(points[i].day)}</b>: {points[i].total} {unit}</>);
  };
  const last = points[points.length - 1];
  return (
    <div className="chart" ref={t.box}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="area-chart"
        role="img"
        aria-label={`${label}: von ${points[0]?.total ?? 0} auf ${last?.total ?? 0} ${unit}`}
        onMouseMove={onMove}
        onMouseLeave={() => (setHover(null), t.hide())}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={P.l - 6} y={y(v) + 4} className="axis" textAnchor="end">{v}</text>
          </g>
        ))}
        <path d={area} className="area" />
        <path d={line} className="line" />
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={y(0)} className="crosshair" />
            <circle cx={x(hover)} cy={y(points[hover].total)} r={4.5} className="dot" />
          </>
        )}
        {[0, Math.floor(points.length / 2), points.length - 1].map((i) => (
          <text key={i} x={x(i)} y={H - 5} className="axis" textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}>
            {points[i] ? DATE.format(points[i].day) : ""}
          </text>
        ))}
      </svg>
      {t.node}
    </div>
  );
}

/** Horizontaler Fortschrittsbalken mit Beschriftung. */
export function Meter({ label, value, total, note }: { label: string; value: number; total: number; note?: string }) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="meter" role="img" aria-label={`${label}: ${value} von ${total} (${pct} %)`}>
      <div className="meter-head">
        <b>{label}</b>
        <span className="muted small">
          {value}/{total} · {pct} %{note ? ` · ${note}` : ""}
        </span>
      </div>
      <div className="meter-track">
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
