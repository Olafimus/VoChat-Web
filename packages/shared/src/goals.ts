/**
 * Eigene Ziele („so viele Wörter bis …“, „diese Sammlung bis …“, Serien, Checklisten).
 * Der Fortschritt wird lokal aus Karten, Lernhistorie und Sammlungen berechnet – nichts davon
 * wird doppelt gespeichert. Wörter zählen über Lexem-ID bzw. Sprache + Wortschlüssel nur einmal.
 */
import { z } from "zod";
import { coverage, type CoverageCard, type CoverageItem } from "./coverage.js";
import { lemmaKey } from "./keys.js";
import { LANG_CODES } from "./languages.js";

export const GOAL_KINDS = ["words_new", "words_total", "words_added", "collection", "reviews", "streak", "checklist"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const GOAL_DIFFICULTIES = ["leicht", "mittel", "ambitioniert"] as const;
export type GoalDifficulty = (typeof GOAL_DIFFICULTIES)[number];

const timestamp = z.number().int().nonnegative();

export const goalSchema = z.object({
  id: z.string().min(8).max(64),
  title: z.string().trim().min(1).max(160),
  kind: z.enum(GOAL_KINDS),
  /** Zielwert: Anzahl Wörter/Wiederholungen/Tage, bei Sammlungen Prozent (1–100); Checklisten: ungenutzt. */
  target: z.number().int().min(1).max(100_000),
  /** Sprache für Wortziele; null = alle Sprachen. */
  lang: z.enum(LANG_CODES as [string, ...string[]]).nullable().default(null),
  collectionId: z.string().max(64).nullable().default(null),
  /** Stand beim Anlegen (für „neue Wörter“: so viele waren schon bekannt). */
  baseline: z.number().int().min(0).default(0),
  items: z
    .array(z.object({ id: z.string().min(1).max(64), text: z.string().trim().min(1).max(200), done: z.boolean(), doneAt: timestamp.nullable().default(null) }))
    .max(50)
    .default([]),
  startAt: timestamp,
  deadline: timestamp.nullable().default(null),
  /** Gesetzt, sobald das Ziel erstmals erreicht wurde. */
  completedAt: timestamp.nullable().default(null),
  archived: z.boolean().default(false),
  template: z.string().max(64).nullable().default(null),
  difficulty: z.enum(GOAL_DIFFICULTIES).nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
  deleted: z.boolean(),
});
export type Goal = z.infer<typeof goalSchema>;

// ---- Fortschritt -------------------------------------------------------------

export interface GoalCard extends CoverageCard {
  createdAt: number;
}
export interface GoalReview {
  at: number;
  manual?: boolean;
  deleted?: boolean;
}
export interface GoalCollection {
  id: string;
  title: string;
  items: CoverageItem[];
  deleted: boolean;
}
export interface GoalContext {
  cards: GoalCard[];
  reviews: GoalReview[];
  collections: GoalCollection[];
  now: number;
  /** Beginn des Kalendertags (lokale Zeit) – für Serien. */
  dayStart: (t: number) => number;
}

export type GoalPace = "reached" | "ahead" | "on_track" | "behind" | "overdue" | "open";

export interface GoalProgress {
  current: number;
  target: number;
  /** 0–1 */
  ratio: number;
  reached: boolean;
  pace: GoalPace;
  /** Verbleibende ganze Tage bis zur Frist (0 = heute), null ohne Frist. */
  daysLeft: number | null;
  /** Anteil der verstrichenen Zeit (0–1), null ohne Frist. */
  timeRatio: number | null;
  /** Nötiges Tempo für den Rest (pro Tag), null ohne Frist oder wenn erreicht. */
  perDay: number | null;
  /** Einheit für die Anzeige. */
  unit: string;
  missingCollection?: boolean;
}

const DAY = 86_400_000;

/** Wörter eindeutig zählen: Lexem-ID, sonst Sprache + Wortschlüssel. */
function uniqueWords(cards: GoalCard[], pred: (c: GoalCard) => boolean): number {
  const seen = new Set<string>();
  for (const c of cards) {
    if (c.deleted || !pred(c)) continue;
    seen.add(c.lexemeId ? `id:${c.lexemeId}` : `${c.lang}:${lemmaKey(c.lemma)}`);
  }
  return seen.size;
}

const isKnown = (c: GoalCard) => c.status === "review" || c.status === "mastered";

/** Bekannte Wörter (gefestigt: Status „wiederholen“ oder „gemeistert“). */
export function knownWords(cards: GoalCard[], lang: string | null): number {
  return uniqueWords(cards, (c) => isKnown(c) && (!lang || c.lang === lang));
}

/** Aufeinanderfolgende Lerntage bis heute (heute noch nicht gelernt: bis gestern). */
export function streakDays(reviews: GoalReview[], now: number, dayStart: (t: number) => number): number {
  const days = new Set(reviews.filter((r) => !r.deleted && !r.manual).map((r) => dayStart(r.at)));
  let day = dayStart(now);
  if (!days.has(day)) day = dayStart(day - DAY / 2);
  let n = 0;
  while (days.has(day)) {
    n++;
    day = dayStart(day - DAY / 2);
  }
  return n;
}

function currentValue(goal: Goal, ctx: GoalContext): { value: number; target: number; unit: string; missingCollection?: boolean } {
  const lang = goal.lang;
  switch (goal.kind) {
    case "words_new":
      return { value: Math.max(0, knownWords(ctx.cards, lang) - goal.baseline), target: goal.target, unit: "Wörter" };
    case "words_total":
      return { value: knownWords(ctx.cards, lang), target: goal.target, unit: "Wörter" };
    case "words_added":
      return { value: uniqueWords(ctx.cards, (c) => c.createdAt >= goal.startAt && (!lang || c.lang === lang)), target: goal.target, unit: "Wörter" };
    case "reviews":
      return { value: ctx.reviews.filter((r) => !r.deleted && !r.manual && r.at >= goal.startAt).length, target: goal.target, unit: "Antworten" };
    case "streak":
      return { value: streakDays(ctx.reviews, ctx.now, ctx.dayStart), target: goal.target, unit: "Tage" };
    case "collection": {
      const c = ctx.collections.find((x) => x.id === goal.collectionId && !x.deleted);
      if (!c) return { value: 0, target: goal.target, unit: "%", missingCollection: true };
      return { value: Math.floor(coverage(c.items, ctx.cards).ratio * 100), target: Math.min(100, goal.target), unit: "%" };
    }
    case "checklist":
      return { value: goal.items.filter((i) => i.done).length, target: Math.max(1, goal.items.length), unit: "erledigt" };
  }
}

export function goalProgress(goal: Goal, ctx: GoalContext): GoalProgress {
  const { value, target, unit, missingCollection } = currentValue(goal, ctx);
  const ratio = Math.max(0, Math.min(1, value / target));
  const reached = value >= target && !missingCollection;
  let daysLeft: number | null = null;
  let timeRatio: number | null = null;
  let perDay: number | null = null;
  let pace: GoalPace = reached ? "reached" : "open";
  if (goal.deadline !== null) {
    daysLeft = Math.max(0, Math.ceil((ctx.dayStart(goal.deadline) - ctx.dayStart(ctx.now)) / DAY));
    const span = Math.max(1, goal.deadline - goal.startAt);
    timeRatio = Math.max(0, Math.min(1, (ctx.now - goal.startAt) / span));
    if (!reached) {
      // Serien wachsen höchstens um einen Tag pro Tag; sonst gleichmäßiges Tempo bis zur Frist.
      perDay = goal.kind === "streak" ? 1 : (target - value) / Math.max(1, daysLeft + 1);
      pace =
        ctx.now > goal.deadline ? "overdue"
        : goal.kind === "streak" ? (target - value <= daysLeft + 1 ? "on_track" : "behind")
        : ratio >= timeRatio + 0.1 ? "ahead"
        : ratio + 0.1 >= timeRatio ? "on_track"
        : "behind";
    }
  }
  return { current: value, target, ratio, reached, pace, daysLeft, timeRatio, perDay, unit, missingCollection };
}

/** Wie anspruchsvoll ist ein Wortziel? Neue Wörter pro Tag bis zur Frist. */
export function wordsPerDayHint(perDay: number): { level: GoalDifficulty; text: string } {
  if (perDay <= 3) return { level: "leicht", text: "entspannt – wenige Minuten am Tag" };
  if (perDay <= 8) return { level: "mittel", text: "machbar mit täglichem Lernen" };
  if (perDay <= 20) return { level: "ambitioniert", text: "ambitioniert – plane täglich feste Lernzeit ein" };
  return { level: "ambitioniert", text: "sehr viel – mehr als 20 neue Wörter am Tag behält kaum jemand dauerhaft" };
}

// ---- Vorlagen ----------------------------------------------------------------

export interface GoalTemplate {
  id: string;
  difficulty: GoalDifficulty;
  title: string;
  description: string;
  kind: GoalKind;
  target: number;
  /** Frist in Tagen ab heute (null = ohne Frist). */
  days: number | null;
  items?: string[];
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  // leicht
  { id: "words-50-30", difficulty: "leicht", kind: "words_new", target: 50, days: 30, title: "50 neue Wörter in 30 Tagen", description: "Knapp 2 Wörter am Tag – ideal zum Einstieg." },
  { id: "streak-7", difficulty: "leicht", kind: "streak", target: 7, days: 10, title: "7 Tage am Stück lernen", description: "Eine Woche lang jeden Tag eine kleine Runde." },
  { id: "reviews-200-14", difficulty: "leicht", kind: "reviews", target: 200, days: 14, title: "200 Antworten in 2 Wochen", description: "Rund 15 Karten am Tag festigen den Wortschatz." },
  {
    id: "first-chat",
    difficulty: "leicht",
    kind: "checklist",
    target: 1,
    days: 21,
    title: "Mein erstes Gespräch",
    description: "Die Grundlagen, um jemandem in der Lernsprache zu schreiben.",
    items: ["Begrüßung und Verabschiedung lernen", "Mich vorstellen (Name, Herkunft, Beruf)", "Zahlen 1–20 lernen", "20 Alltagswörter lernen", "Eine Nachricht an einen Freund schreiben", "Eine Korrektur annehmen"],
  },
  // mittel
  { id: "words-300-90", difficulty: "mittel", kind: "words_new", target: 300, days: 90, title: "300 neue Wörter in 3 Monaten", description: "Gut 3 Wörter am Tag – genug für einfache Gespräche." },
  { id: "collection-80-42", difficulty: "mittel", kind: "collection", target: 80, days: 42, title: "Eine Sammlung zu 80 % kennen", description: "Lied, Buch oder Lernpfad: in 6 Wochen 80 % der Wörter sicher." },
  { id: "streak-30", difficulty: "mittel", kind: "streak", target: 30, days: 35, title: "30-Tage-Serie", description: "Einen Monat lang jeden Tag lernen." },
  { id: "reviews-1500-30", difficulty: "mittel", kind: "reviews", target: 1500, days: 30, title: "1500 Antworten in 30 Tagen", description: "Etwa 50 Karten am Tag." },
  {
    id: "a1-basics",
    difficulty: "mittel",
    kind: "checklist",
    target: 1,
    days: 60,
    title: "A1-Grundlagen",
    description: "Die Themen der ersten Stufe abhaken.",
    items: ["Familie und Freunde", "Essen und Trinken", "Uhrzeit und Wochentage", "Wegbeschreibung", "Einkaufen", "Wetter", "Hobbys", "Ein kurzer Text über mich"],
  },
  // ambitioniert
  { id: "words-1000-180", difficulty: "ambitioniert", kind: "words_new", target: 1000, days: 180, title: "1000 neue Wörter in 6 Monaten", description: "Rund 5–6 Wörter am Tag – die häufigsten 1000 decken den Großteil von Alltagstexten ab." },
  { id: "words-total-2000-365", difficulty: "ambitioniert", kind: "words_total", target: 2000, days: 365, title: "Wortschatz von 2000 Wörtern", description: "Grundlage für B1 – in einem Jahr." },
  { id: "collection-100-30", difficulty: "ambitioniert", kind: "collection", target: 100, days: 30, title: "Eine Sammlung komplett", description: "Jedes Wort einer Sammlung in 30 Tagen sicher können." },
  { id: "streak-100", difficulty: "ambitioniert", kind: "streak", target: 100, days: 110, title: "100-Tage-Serie", description: "Hundert Tage ohne Pause." },
];

export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  words_new: "Neue Wörter sicher lernen",
  words_total: "Wortschatz-Größe erreichen",
  words_added: "Wörter hinzufügen",
  collection: "Sammlung/Lernpfad kennen",
  reviews: "Antworten (Wiederholungen)",
  streak: "Lernserie (Tage am Stück)",
  checklist: "Checkliste",
};
