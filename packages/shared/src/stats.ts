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
