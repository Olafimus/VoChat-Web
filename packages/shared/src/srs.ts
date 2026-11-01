/**
 * Zeitplan einer Karte – abgeleitet aus dem Gedächtnismodell (`memory.ts`) und der Lernhistorie.
 * Die Karte speichert das Ergebnis (Stabilität, Schwierigkeit, Fälligkeit), damit Listen und Planer
 * nicht ständig neu rechnen müssen; Quelle der Wahrheit ist aber immer die Historie.
 */
import { dueAfter, replay, statusFor, type CardStatus, type Grade, type ReviewInput } from "./memory.js";


export interface Schedule {
  status: CardStatus;
  /** Stabilität in Tagen (0 = noch nie gelernt). */
  stability: number;
  /** Schwierigkeit 1–10 (5 = noch unbekannt). */
  difficulty: number;
  /** Aktuelles Intervall in Tagen (bis zur nächsten Fälligkeit). */
  intervalDays: number;
  /** Für ältere Clients: aus der Schwierigkeit abgeleitet (1,3–3,0). */
  ease: number;
  reps: number;
  lapses: number;
  dueAt: number;
  lastReviewAt: number | null;
}

export const DEFAULT_RETENTION = 0.9;

export const newSchedule = (now: number): Schedule => ({
  status: "new",
  stability: 0,
  difficulty: 5,
  intervalDays: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
  dueAt: now,
  lastReviewAt: null,
});

const easeFor = (difficulty: number) => Math.round((3 - ((difficulty - 1) / 9) * 1.7) * 100) / 100;

/** Zeitplan aus der vollständigen Historie einer Karte. */
export function scheduleFromHistory(reviews: ReviewInput[], opts: { retention?: number; seed?: string; createdAt: number }): Schedule {
  const r = replay(reviews);
  if (!r.state || r.lastReviewAt === null) return newSchedule(opts.createdAt);
  const lastGrade = r.steps[r.steps.length - 1].grade;
  const dueAt = dueAfter(r.state, r.lastReviewAt, lastGrade, opts.retention ?? DEFAULT_RETENTION, opts.seed);
  return {
    status: statusFor(r.state, lastGrade),
    stability: r.state.stability,
    difficulty: r.state.difficulty,
    intervalDays: (dueAt - r.lastReviewAt) / (24 * 60 * 60 * 1000),
    ease: easeFor(r.state.difficulty),
    reps: r.reps,
    lapses: r.lapses,
    dueAt,
    lastReviewAt: r.lastReviewAt,
  };
}

/** Alte Lernereignisse haben nur richtig/falsch: als „gut“ bzw. „nochmal“ werten. */
export const gradeOf = (review: { grade?: Grade | null; outcome: "right" | "wrong" }): Grade =>
  review.grade ?? (review.outcome === "right" ? "good" : "again");

export const isDue = (schedule: Pick<Schedule, "dueAt" | "status">, now: number): boolean =>
  schedule.status !== "new" && schedule.dueAt <= now;
