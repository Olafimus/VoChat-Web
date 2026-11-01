/**
 * Lernstatistik – damit nachvollziehbar ist, was der Planer tut und wie gut das Modell zu dir passt.
 * Alles wird lokal aus Karten und Lernhistorie berechnet.
 */
import { DAY_MS, replay, retrievability, type Grade } from "./memory.js";

export interface StatsCard {
  id: string;
  status: "new" | "learning" | "review" | "mastered";
  stability: number;
  lastReviewAt: number | null;
  ignored?: boolean;
  resetAt?: number | null;
}

export interface StatsReview {
  cardId: string;
  at: number;
  grade: Grade;
  manual?: boolean;
  responseMs?: number | null;
}

export interface CalibrationBin {
  label: string;
  /** Vom Modell vorhergesagte mittlere Erinnerung. */
  predicted: number;
  /** Tatsächlicher Anteil richtiger Antworten. */
  actual: number;
  n: number;
}

export interface LearningStats {
  cards: { total: number; ignored: number; new: number; learning: number; review: number; mastered: number };
  /** Karten, die jetzt mit ≥ 90 % sitzen bzw. unter 70 % gefährdet sind. */
  safeNow: number;
  atRisk: number;
  /** Echte Behaltensquote: Antworten nach mindestens einem Tag Pause. */
  retention: { rate: number | null; n: number };
  /** Antworten am selben Tag (z. B. nach einem Fehler) – zählen wenig für das Langzeitgedächtnis. */
  sameDay: { rate: number | null; n: number };
  calibration: CalibrationBin[];
  streakDays: number;
  today: { reviews: number; correct: number; minutes: number };
  /** Letzte 30 Tage, ältester zuerst. */
  daily: { day: number; reviews: number; correct: number }[];
  /** Median der Stabilität gelernter Karten (Tage). */
  medianStability: number | null;
}

const BINS: [number, number, string][] = [
  [0, 0.5, "< 50 %"],
  [0.5, 0.7, "50–70 %"],
  [0.7, 0.8, "70–80 %"],
  [0.8, 0.9, "80–90 %"],
  [0.9, 1.01, "≥ 90 %"],
];

export function computeStats(cards: StatsCard[], reviews: StatsReview[], now: number, startOfToday: number): LearningStats {
  const byCard = new Map<string, StatsReview[]>();
  for (const r of reviews) {
    const list = byCard.get(r.cardId);
    if (list) list.push(r);
    else byCard.set(r.cardId, [r]);
  }

  const counts = { total: 0, ignored: 0, new: 0, learning: 0, review: 0, mastered: 0 };
  let safeNow = 0;
  let atRisk = 0;
  const stabilities: number[] = [];
  let retRight = 0;
  let retN = 0;
  let sameRight = 0;
  let sameN = 0;
  const bins = BINS.map(() => ({ pred: 0, right: 0, n: 0 }));

  for (const c of cards) {
    counts.total++;
    if (c.ignored) {
      counts.ignored++;
      continue;
    }
    counts[c.status]++;
    if (c.lastReviewAt !== null && c.status !== "new") {
      const r = retrievability((now - c.lastReviewAt) / DAY_MS, c.stability);
      if (r >= 0.9) safeNow++;
      else if (r < 0.7) atRisk++;
      stabilities.push(c.stability);
    }
    const history = (byCard.get(c.id) ?? []).filter((r) => !c.resetAt || r.at >= c.resetAt);
    const real = history.filter((r) => !r.manual);
    // Vorhersage vor jeder echten Antwort mit dem Zustand aus allen vorherigen Antworten
    const steps = replay(history.map((r) => ({ at: r.at, grade: r.grade }))).steps;
    for (const step of steps) {
      if (step.recall === null || step.elapsedDays === null) continue;
      const src = real.find((r) => r.at === step.at);
      if (!src) continue;
      const ok = step.grade !== "again";
      if (step.elapsedDays >= 1) {
        retN++;
        if (ok) retRight++;
        const bi = BINS.findIndex(([lo, hi]) => step.recall! >= lo && step.recall! < hi);
        if (bi >= 0) {
          bins[bi].n++;
          bins[bi].pred += step.recall;
          if (ok) bins[bi].right++;
        }
      } else {
        sameN++;
        if (ok) sameRight++;
      }
    }
  }

  // Tagesverlauf und Serie
  const daily = Array.from({ length: 30 }, (_, i) => ({ day: startOfToday - (29 - i) * DAY_MS, reviews: 0, correct: 0 }));
  const activeDays = new Set<number>();
  let todayMs = 0;
  const today = { reviews: 0, correct: 0, minutes: 0 };
  for (const r of reviews) {
    if (r.manual) continue;
    const dayIndex = Math.floor((r.at - startOfToday) / DAY_MS); // 0 = heute, negativ = früher
    activeDays.add(dayIndex);
    const slot = 29 + dayIndex;
    if (slot >= 0 && slot < 30) {
      daily[slot].reviews++;
      if (r.grade !== "again") daily[slot].correct++;
    }
    if (dayIndex === 0) {
      today.reviews++;
      if (r.grade !== "again") today.correct++;
      if (r.responseMs && r.responseMs < 120_000) todayMs += r.responseMs;
    }
  }
  today.minutes = Math.round(todayMs / 60_000);
  // Serie: aufeinanderfolgende Tage mit Lernen; heute zählt mit, fehlt heute noch, zählt sie ab gestern
  let streakDays = 0;
  for (let d = activeDays.has(0) ? 0 : -1; activeDays.has(d); d--) streakDays++;

  stabilities.sort((a, b) => a - b);
  return {
    cards: counts,
    safeNow,
    atRisk,
    retention: { rate: retN ? retRight / retN : null, n: retN },
    sameDay: { rate: sameN ? sameRight / sameN : null, n: sameN },
    calibration: BINS.map(([, , label], i) => ({
      label,
      predicted: bins[i].n ? bins[i].pred / bins[i].n : 0,
      actual: bins[i].n ? bins[i].right / bins[i].n : 0,
      n: bins[i].n,
    })),
    streakDays,
    today,
    daily,
    medianStability: stabilities.length ? stabilities[Math.floor(stabilities.length / 2)] : null,
  };
}

// ---- Erweiterte Auswertungen für die Statistik-Seite ---------------------------------

export interface InsightCard extends StatsCard {
  lemma: string;
  cefr?: string | null;
  difficulty?: number;
  lapses?: number;
}

export interface Insights {
  /** Antworten je Tag, die letzten `heatmapDays` Tage (ältester zuerst). */
  heatmap: { day: number; reviews: number }[];
  /** Kumulierte Zahl gelernter Wörter (erste Antwort) je Tag, letzte 90 Tage. */
  growth: { day: number; total: number }[];
  /** Wie fest sitzen die Wörter? Verteilung der Stabilität. */
  stability: { label: string; count: number }[];
  /** Antworten je Tagesstunde (0–23) und Trefferquote je Stunde. */
  hours: { hour: number; reviews: number; correct: number }[];
  /** Schwierigste Wörter (meist vergessen, höchste Schwierigkeit). */
  hardest: { id: string; lemma: string; lapses: number; difficulty: number }[];
  /** Nach Niveau: gelernt (mind. „review“) / gesamt. */
  levels: { level: string; known: number; total: number }[];
  /** Mittlere Antwortzeit (s) der letzten 200 Antworten. */
  avgResponseSec: number | null;
}

const STABILITY_BUCKETS: [number, string][] = [
  [1, "< 1 Tag"],
  [7, "1–7 Tage"],
  [30, "1–4 Wochen"],
  [90, "1–3 Monate"],
  [365, "3–12 Monate"],
  [Infinity, "> 1 Jahr"],
];

export function computeInsights(
  cards: InsightCard[],
  reviews: StatsReview[],
  startOfToday: number,
  hourOf: (t: number) => number,
  heatmapDays = 182,
): Insights {
  const dayIndex = (t: number) => Math.floor((t - startOfToday) / DAY_MS); // 0 = heute
  const heatmap = Array.from({ length: heatmapDays }, (_, i) => ({ day: startOfToday - (heatmapDays - 1 - i) * DAY_MS, reviews: 0 }));
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, reviews: 0, correct: 0 }));
  const firstSeen = new Map<string, number>();
  const real = reviews.filter((r) => !r.manual);
  for (const r of real) {
    const di = dayIndex(r.at);
    const slot = heatmapDays - 1 + di;
    if (slot >= 0 && slot < heatmapDays) heatmap[slot].reviews++;
    const h = hours[hourOf(r.at)];
    if (h) {
      h.reviews++;
      if (r.grade !== "again") h.correct++;
    }
  }
  for (const r of reviews) {
    const prev = firstSeen.get(r.cardId);
    if (prev === undefined || r.at < prev) firstSeen.set(r.cardId, r.at);
  }
  const growthDays = 90;
  const firsts = [...firstSeen.values()].sort((a, b) => a - b);
  let k = 0;
  const growth = Array.from({ length: growthDays }, (_, i) => {
    const day = startOfToday - (growthDays - 1 - i) * DAY_MS;
    while (k < firsts.length && firsts[k] < day + DAY_MS) k++;
    return { day, total: k };
  });

  const active = cards.filter((c) => !c.ignored);
  const stability = STABILITY_BUCKETS.map(([, label]) => ({ label, count: 0 }));
  for (const c of active) {
    if (c.status === "new" || !c.stability) continue;
    const i = STABILITY_BUCKETS.findIndex(([max]) => c.stability < max);
    stability[i].count++;
  }

  const hardest = active
    .filter((c) => (c.lapses ?? 0) > 0 || (c.difficulty ?? 0) >= 7)
    .sort((a, b) => (b.lapses ?? 0) - (a.lapses ?? 0) || (b.difficulty ?? 0) - (a.difficulty ?? 0))
    .slice(0, 10)
    .map((c) => ({ id: c.id, lemma: c.lemma, lapses: c.lapses ?? 0, difficulty: c.difficulty ?? 5 }));

  const levelOrder = ["A1", "A2", "B1", "B2", "C1", "C2"];
  const levels = levelOrder
    .map((level) => {
      const of = active.filter((c) => c.cefr === level);
      return { level, total: of.length, known: of.filter((c) => c.status === "review" || c.status === "mastered").length };
    })
    .filter((l) => l.total > 0);

  const recent = real.filter((r) => r.responseMs && r.responseMs < 120_000).slice(-200);
  const avgResponseSec = recent.length ? recent.reduce((s, r) => s + r.responseMs!, 0) / recent.length / 1000 : null;
  return { heatmap, growth, stability, hours, hardest, levels, avgResponseSec };
}
