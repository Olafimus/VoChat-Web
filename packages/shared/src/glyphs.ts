import { z } from "zod";
import { LANG_CODES } from "./languages.js";
import { dueAfter, initialState, nextState, statusFor, DAY_MS, type CardStatus, type Grade } from "./memory.js";

/**
 * Zeichen lernen (Schriften, deren Zeichen eigene Lerneinheiten sind – zuerst Japanisch).
 *
 * Je Zeichen gibt es zwei Fertigkeiten mit eigenem Gedächtnismodell (FSRS wie bei Vokabeln):
 *  - read:  Zeichen sehen → Lesung/Bedeutung erkennen
 *  - write: Lesung/Bedeutung sehen → Zeichen aus dem Gedächtnis schreiben (Masterclass, Strichreihenfolge)
 * Nachzeichnen (mit Vorlage) ist Einführung und Übung und zählt nur als Zähler `traces`.
 */

export const GLYPH_SCRIPTS = ["hiragana", "katakana", "kanji"] as const;
export type GlyphScript = (typeof GLYPH_SCRIPTS)[number];
export const GLYPH_SKILLS = ["read", "write"] as const;
export type GlyphSkill = (typeof GLYPH_SKILLS)[number];

/** Sprachen mit Zeichen-Lernen und ihren Schriften. */
export const GLYPH_LANGS: Partial<Record<string, readonly GlyphScript[]>> = { ja: GLYPH_SCRIPTS };
export const hasGlyphLearning = (lang: string): boolean => !!GLYPH_LANGS[lang];

const timestamp = z.number().int().nonnegative();
const langSchema = z.enum(LANG_CODES as [string, ...string[]]);

export const glyphTrackSchema = z.object({
  stability: z.number().min(0).max(36500),
  difficulty: z.number().min(1).max(10),
  lastReviewAt: timestamp,
  lastGrade: z.enum(["again", "hard", "good", "easy"]),
  dueAt: timestamp,
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  /** Masterclass: Fehler beim letzten Versuch (für „schwierigste Zeichen“). */
  lastMistakes: z.number().int().nonnegative().default(0),
});
export type GlyphTrack = z.infer<typeof glyphTrackSchema>;

/** Lernstand eines Zeichens. Die ID ist aus Sprache und Codepunkt abgeleitet: Geräte erzeugen dieselbe Zeile. */
export const glyphSchema = z.object({
  id: z.string().min(8).max(64),
  lang: langSchema,
  char: z.string().min(1).max(8),
  script: z.enum(GLYPH_SCRIPTS),
  read: glyphTrackSchema.nullable().default(null),
  write: glyphTrackSchema.nullable().default(null),
  traces: z.number().int().nonnegative().default(0),
  createdAt: timestamp,
  updatedAt: timestamp,
  deleted: z.boolean(),
});
export type GlyphProgress = z.infer<typeof glyphSchema>;

export const glyphId = (lang: string, char: string): string =>
  `g-${lang}-${[...char].map((c) => c.codePointAt(0)!.toString(16).padStart(5, "0")).join("")}`;

/** Neuer Stand einer Fertigkeit nach einer Antwort. */
export function applyGlyphAnswer(track: GlyphTrack | null, grade: Grade, at: number, retention: number, seed = "", mistakes = 0): GlyphTrack {
  const state = track ? nextState(track, grade, Math.max(0, (at - track.lastReviewAt) / DAY_MS)) : initialState(grade);
  return {
    stability: state.stability,
    difficulty: state.difficulty,
    lastReviewAt: at,
    lastGrade: grade,
    dueAt: dueAfter(state, at, grade, retention, seed),
    reps: (track?.reps ?? 0) + 1,
    lapses: (track?.lapses ?? 0) + (track && grade === "again" ? 1 : 0),
    lastMistakes: mistakes,
  };
}

export const glyphStatus = (track: GlyphTrack | null | undefined): CardStatus => (track ? statusFor(track, track.lastGrade) : "new");

export interface GlyphPlanItem {
  char: string;
  kind: "relearn" | "review" | "new";
}

export interface GlyphPlanInput {
  /** Zeichen der gewählten Kategorie in Lernreihenfolge. */
  candidates: string[];
  progress: Map<string, GlyphProgress>;
  skill: GlyphSkill;
  now: number;
  /** Höchstzahl neuer Zeichen in diesem Block. */
  newLimit: number;
  size: number;
  /** Fällige Zeichen außerhalb der Kategorie ebenfalls einplanen (Standard: nein). */
  includeAllDue?: boolean;
}

/** Lernblock: zuerst kurz zuvor Falsches, dann Fällige (am längsten überfällig zuerst), dann Neue in Reihenfolge. */
export function planGlyphSession(input: GlyphPlanInput): GlyphPlanItem[] {
  const { candidates, progress, skill, now, newLimit, size } = input;
  const inScope = new Set(candidates);
  const due: { char: string; dueAt: number; relearn: boolean }[] = [];
  for (const p of progress.values()) {
    const t = p[skill];
    if (p.deleted || !t || t.dueAt > now) continue;
    if (!input.includeAllDue && !inScope.has(p.char)) continue;
    due.push({ char: p.char, dueAt: t.dueAt, relearn: t.lastGrade === "again" });
  }
  due.sort((a, b) => Number(b.relearn) - Number(a.relearn) || a.dueAt - b.dueAt);
  const items: GlyphPlanItem[] = due.slice(0, size).map((d) => ({ char: d.char, kind: d.relearn ? "relearn" : "review" }));
  let added = 0;
  for (const c of candidates) {
    if (items.length >= size || added >= newLimit) break;
    if (progress.get(c)?.[skill]) continue;
    items.push({ char: c, kind: "new" });
    added++;
  }
  return items;
}

export interface GlyphCounts {
  total: number;
  seen: number;
  learning: number;
  review: number;
  mastered: number;
  due: number;
}

export function glyphCounts(chars: string[], progress: Map<string, GlyphProgress>, skill: GlyphSkill, now: number): GlyphCounts {
  const out: GlyphCounts = { total: chars.length, seen: 0, learning: 0, review: 0, mastered: 0, due: 0 };
  for (const c of chars) {
    const t = progress.get(c)?.[skill];
    if (!t) continue;
    out.seen++;
    const s = glyphStatus(t);
    if (s === "learning") out.learning++;
    else if (s === "review") out.review++;
    else if (s === "mastered") out.mastered++;
    if (t.dueAt <= now) out.due++;
  }
  return out;
}

/**
 * Antwortmöglichkeiten für „Erkennen“: richtige Antwort plus `count − 1` verschiedene Ablenker.
 * Ähnliche Zeichen (gleiche Strichzahl ± 2) werden bevorzugt, damit es nicht zu leicht wird.
 */
export function buildChoices<T extends { c: string; strokes: number }>(
  target: T,
  pool: T[],
  answerOf: (g: T) => string,
  count = 4,
  random: () => number = Math.random,
): string[] {
  const correct = answerOf(target);
  const seen = new Set([correct]);
  const shuffled = [...pool].sort(() => random() - 0.5);
  const near = shuffled.filter((g) => Math.abs(g.strokes - target.strokes) <= 2);
  const options = [correct];
  for (const g of [...near, ...shuffled]) {
    if (options.length >= count) break;
    const a = answerOf(g);
    if (g.c === target.c || !a || seen.has(a)) continue;
    seen.add(a);
    options.push(a);
  }
  return options.sort(() => random() - 0.5);
}
