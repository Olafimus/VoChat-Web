/**
 * Spaced-Repetition-Logik (SM-2-ähnlich, vereinfacht). Reine Funktionen ohne
 * I/O, damit Client und Server identisch rechnen und die Logik testbar bleibt.
 */

export type Grade = "again" | "hard" | "good" | "easy";
export type CardStatus = "new" | "learning" | "review" | "mastered";

export interface Schedule {
  status: CardStatus;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
  dueAt: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const RELEARN_MS = 10 * 60 * 1000;
const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const MASTERED_INTERVAL_DAYS = 21;

export const newSchedule = (now: number): Schedule => ({
  status: "new",
  ease: 2.5,
  intervalDays: 0,
  reps: 0,
  lapses: 0,
  dueAt: now,
});

const clampEase = (ease: number) => Math.min(MAX_EASE, Math.max(MIN_EASE, ease));

export function reviewCard(prev: Schedule, grade: Grade, now: number): Schedule {
  if (grade === "again") {
    return {
      ...prev,
      status: "learning",
      ease: clampEase(prev.ease - 0.2),
      intervalDays: 0,
      reps: prev.reps + 1,
      lapses: prev.reps > 0 ? prev.lapses + 1 : prev.lapses,
      dueAt: now + RELEARN_MS,
    };
  }

  let ease = prev.ease;
  let intervalDays: number;

  if (grade === "hard") {
    ease = clampEase(prev.ease - 0.15);
    intervalDays = prev.reps === 0 ? 1 : Math.max(1, prev.intervalDays * 1.2);
  } else if (grade === "good") {
    if (prev.reps === 0) intervalDays = 1;
    else if (prev.reps === 1) intervalDays = 3;
    else intervalDays = Math.max(1, prev.intervalDays * prev.ease);
  } else {
    ease = clampEase(prev.ease + 0.15);
    intervalDays = prev.reps === 0 ? 4 : Math.max(4, prev.intervalDays * prev.ease * 1.3);
  }

  const status: CardStatus = intervalDays >= MASTERED_INTERVAL_DAYS ? "mastered" : "review";
  return {
    status,
    ease,
    intervalDays,
    reps: prev.reps + 1,
    lapses: prev.lapses,
    dueAt: now + Math.round(intervalDays * DAY_MS),
  };
}

export const isDue = (schedule: Pick<Schedule, "dueAt" | "status">, now: number): boolean =>
  schedule.status !== "mastered" && schedule.dueAt <= now;
