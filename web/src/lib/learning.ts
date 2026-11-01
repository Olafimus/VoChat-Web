import { useEffect, useState } from "react";
import {
  DEFAULT_PLANNER,
  gradeOf,
  scheduleFromHistory,
  type Grade,
  type PlannerCard,
  type PlannerSettings,
  type StatsCard,
  type StatsReview,
} from "@vochat/shared";
import type { CardRow, ReviewRow } from "../local/collections";
import { prefs } from "./prefs";

/** Lern-Einstellungen (gerätebezogen, im Profil/Statistik einstellbar). */
export interface LearningSettings {
  retention: number;
  newPerDay: number;
  maxReviewsPerDay: number;
  blockSize: number;
}

export const DEFAULT_LEARNING: LearningSettings = {
  retention: DEFAULT_PLANNER.retention,
  newPerDay: DEFAULT_PLANNER.newPerDay,
  maxReviewsPerDay: DEFAULT_PLANNER.maxReviewsPerDay,
  blockSize: 20,
};

const KEY = "vochat.learning";
const listeners = new Set<() => void>();

export function readLearning(): LearningSettings {
  try {
    const raw = prefs.get(KEY);
    return raw ? { ...DEFAULT_LEARNING, ...(JSON.parse(raw) as Partial<LearningSettings>) } : DEFAULT_LEARNING;
  } catch {
    return DEFAULT_LEARNING;
  }
}

export function writeLearning(next: LearningSettings): void {
  prefs.set(KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

export function useLearningSettings(): LearningSettings {
  const [value, setValue] = useState(readLearning);
  useEffect(() => {
    const fn = () => setValue(readLearning());
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return value;
}

export const startOfToday = (now = Date.now()): number => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Antworten einer Karte, die für das Modell zählen (nach einem Zurücksetzen nur die neueren). */
export function historyOf(card: Pick<CardRow, "id" | "resetAt">, reviews: ReviewRow[]): { at: number; grade: Grade }[] {
  return reviews
    .filter((r) => !r.deleted && r.cardId === card.id && (!card.resetAt || r.at >= card.resetAt))
    .map((r) => ({ at: r.at, grade: gradeOf(r) }));
}

/** Zeitplan einer Karte aus ihrer Historie (optional mit einer hypothetischen weiteren Antwort). */
export function scheduleFor(card: CardRow, reviews: ReviewRow[], settings: LearningSettings, extra?: { at: number; grade: Grade }) {
  const history = historyOf(card, reviews);
  if (extra) history.push(extra);
  return scheduleFromHistory(history, { retention: card.retention ?? settings.retention, seed: card.id, createdAt: card.createdAt });
}

export const toPlannerCard = (c: CardRow): PlannerCard => ({
  id: c.id,
  status: c.status,
  stability: c.stability ?? 0,
  dueAt: c.dueAt,
  lastReviewAt: c.lastReviewAt ?? null,
  createdAt: c.createdAt,
  lapses: c.lapses,
  ignored: c.ignored,
  pinned: c.pinned,
  retention: c.retention,
  rank: c.rank,
  cefr: c.cefr,
  origin: c.origin,
});

export const toStatsCard = (c: CardRow): StatsCard => ({
  id: c.id,
  status: c.status,
  stability: c.stability ?? 0,
  lastReviewAt: c.lastReviewAt ?? null,
  ignored: c.ignored,
  resetAt: c.resetAt,
});

export const toStatsReview = (r: ReviewRow): StatsReview => ({
  cardId: r.cardId,
  at: r.at,
  grade: gradeOf(r),
  manual: r.mode === "manual",
  responseMs: r.responseMs ?? null,
});

export function plannerSettings(s: LearningSettings, extra: Partial<PlannerSettings> = {}): PlannerSettings {
  return { retention: s.retention, newPerDay: s.newPerDay, maxReviewsPerDay: s.maxReviewsPerDay, ...extra };
}

/** Lesbare Dauer: „10 Min.“, „5 Std.“, „3 Tage“, „4 Monate“. */
export function formatDays(days: number): string {
  if (days < 1 / 24) return `${Math.max(1, Math.round(days * 24 * 60))} Min.`;
  if (days < 1) return `${Math.round(days * 24)} Std.`;
  if (days < 45) return `${Math.round(days)} ${Math.round(days) === 1 ? "Tag" : "Tage"}`;
  if (days < 365) return `${Math.round(days / 30)} Monate`;
  return `${(days / 365).toFixed(1).replace(".", ",")} Jahre`;
}
