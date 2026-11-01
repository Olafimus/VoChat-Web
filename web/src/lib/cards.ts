import { lemmaKey, newSchedule, type Grade, type LangCode, type LexemeSummary, type Mode, type Cefr } from "@vochat/shared";
import type { ReviewRow } from "../local/collections";
import { readLearning, scheduleFor } from "./learning";
import type { Collections, CardRow } from "../local/collections";
import { newId } from "./ids";

export interface NewCard {
  lang: LangCode;
  lemma: string;
  lexemeId: number | null;
  gloss: string | null;
  pronunciation?: string | null;
  cefr: Cefr | null;
  /** Felder, die als eigene Werte gelten (nicht vom Wörterbuch überschrieben). */
  custom?: ("lemma" | "gloss" | "pronunciation" | "cefr")[];
  rank?: number | null;
  /** Herkunft: "chat", "scan", "manual", "challenge:<id>", "collection:<id>". */
  origin?: string | null;
}

/** Legt eine Lernkarte an (lokal, sofort sichtbar) und liefert ihre ID. */
export function addCard(collections: Collections, input: NewCard): string {
  const now = Date.now();
  const schedule = newSchedule(now);
  const row: CardRow = {
    id: newId(),
    lang: input.lang,
    lemma: input.lemma,
    lexemeId: input.lexemeId,
    gloss: input.gloss,
    pronunciation: input.pronunciation ?? null,
    custom: input.custom ?? [],
    note: "",
    cefr: input.cefr,
    status: schedule.status,
    ease: schedule.ease,
    intervalDays: schedule.intervalDays,
    dueAt: schedule.dueAt,
    reps: schedule.reps,
    lapses: schedule.lapses,
    stability: 0,
    difficulty: 5,
    lastReviewAt: null,
    ignored: false,
    retention: null,
    pinned: false,
    resetAt: null,
    rank: input.rank ?? null,
    origin: input.origin ?? null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  void collections.cards.insert(row);
  return row.id;
}

export function addCardFromLexeme(collections: Collections, lexeme: LexemeSummary, lang: LangCode, origin: string | null = null): void {
  addCard(collections, {
    rank: lexeme.frequencyRank,
    origin,
    lang,
    lemma: lexeme.lemma,
    lexemeId: lexeme.id,
    gloss: lexeme.gloss,
    pronunciation: lexeme.romanization,
    cefr: (lexeme.cefr as Cefr | null) ?? null,
  });
}

/**
 * Eigenes Wort anlegen, das (noch) nicht aus dem Wörterbuch kommt. Selbst eingetragene Felder gelten
 * als eigene Werte. Die Verknüpfung mit dem Wörterbuch passiert später automatisch über die Schreibung.
 */
export function addOwnWord(
  collections: Collections,
  input: { lang: LangCode; lemma: string; gloss?: string | null; pronunciation?: string | null; origin?: string | null },
): string {
  const gloss = input.gloss?.trim() || null;
  const pronunciation = input.pronunciation?.trim() || null;
  return addCard(collections, {
    lang: input.lang,
    lemma: input.lemma.trim(),
    lexemeId: null,
    gloss,
    pronunciation,
    cefr: null,
    origin: input.origin ?? "manual",
    custom: [...(gloss ? (["gloss"] as const) : []), ...(pronunciation ? (["pronunciation"] as const) : [])],
  });
}

export const hasCardFor = (cards: CardRow[], lexemeId: number): boolean =>
  cards.some((c) => !c.deleted && c.lexemeId === lexemeId);

/** Gibt es schon eine Karte zu diesem Wort? Über die Lexem-ID oder die normalisierte Schreibung. */
export const hasCardWord = (cards: CardRow[], lang: string, lemma: string, lexemeId?: number | null): boolean => {
  const k = lemmaKey(lemma);
  return cards.some((c) => !c.deleted && c.lang === lang && ((lexemeId && c.lexemeId === lexemeId) || lemmaKey(c.lemma) === k));
};

export type EditableField = "lemma" | "gloss" | "pronunciation" | "cefr";

/**
 * Eigene Änderung an einer Karte. Geänderte Felder werden als „eigen“ markiert und beim
 * Abgleich mit dem Wörterbuch nicht überschrieben. Die Verknüpfung (lexemeId) bleibt bestehen.
 */
export function editCard(collections: Collections, card: CardRow, patch: Partial<Pick<CardRow, EditableField | "note">>): void {
  const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => k !== "note" && patch[k] !== card[k]) as EditableField[];
  collections.cards.update(card.id, (d) => {
    Object.assign(d, patch);
    d.custom = [...new Set([...(d.custom ?? []), ...changed])];
    d.updatedAt = Date.now();
  });
}

/** Eigenen Wert verwerfen: Das Feld folgt wieder dem Wörterbuch (übernommen beim nächsten Abgleich). */
export function resetField(collections: Collections, card: CardRow, field: EditableField): void {
  collections.cards.update(card.id, (d) => {
    d.custom = (d.custom ?? []).filter((f) => f !== field);
    d.updatedAt = Date.now();
  });
}

const allReviews = (collections: Collections) => collections.reviews.toArray as ReviewRow[];

/** Zeitplan einer Karte aus ihrer Historie neu berechnen und speichern. */
function reschedule(collections: Collections, card: CardRow, patch: Partial<CardRow> = {}): void {
  const merged = { ...card, ...patch } as CardRow;
  const next = scheduleFor(merged, allReviews(collections), readLearning());
  collections.cards.update(card.id, (d) => {
    Object.assign(d, patch, next, { updatedAt: Date.now() });
  });
}

/**
 * Antwort auswerten: protokolliert das Lernereignis (append-only) und berechnet den Zeitplan der Karte
 * aus ihrer gesamten Historie neu – mit dem zeitlichen Abstand jeder einzelnen Antwort.
 */
export function recordAnswer(
  collections: Collections,
  card: CardRow,
  args: { mode: Mode; grade: Grade; typed: string | null; responseMs?: number | null },
): void {
  const now = Date.now();
  const review: ReviewRow = {
    id: newId(),
    cardId: card.id,
    lang: card.lang,
    lemma: card.lemma,
    outcome: args.grade === "again" ? "wrong" : "right",
    grade: args.grade,
    responseMs: args.responseMs == null ? null : Math.min(3_600_000, Math.max(0, Math.round(args.responseMs))),
    mode: args.mode,
    typed: args.typed,
    at: now,
    updatedAt: now,
    deleted: false,
  };
  void collections.reviews.insert(review);
  const next = scheduleFor(card, [...allReviews(collections).filter((r) => r.id !== review.id), review], readLearning());
  collections.cards.update(card.id, (d) => {
    Object.assign(d, next, { pinned: false, updatedAt: now });
  });
}

// ---- Eigene Entscheidungen (der Lernweg bleibt persönlich) -----------------

/** Wort ausblenden: wird nie geplant, bleibt aber in der Sammlung und in Statistiken sichtbar. */
export const setIgnored = (collections: Collections, card: CardRow, ignored: boolean) =>
  collections.cards.update(card.id, (d) => {
    d.ignored = ignored;
    d.updatedAt = Date.now();
  });

/** Im nächsten Lernblock zuerst. */
export const setPinned = (collections: Collections, card: CardRow, pinned: boolean) =>
  collections.cards.update(card.id, (d) => {
    d.pinned = pinned;
    d.updatedAt = Date.now();
  });

/** Eigene Zielquote: 0,95 = öfter üben, 0,8 = seltener, null = Standard. Plant sofort neu. */
export const setRetention = (collections: Collections, card: CardRow, retention: number | null) =>
  reschedule(collections, card, { retention });

/** „Kenne ich schon“: zählt wie eine sichere Antwort (als manuell markiert, nicht als echte Abfrage). */
export function markKnown(collections: Collections, card: CardRow): void {
  const now = Date.now();
  const review: ReviewRow = {
    id: newId(),
    cardId: card.id,
    lang: card.lang,
    lemma: card.lemma,
    outcome: "right",
    grade: "easy",
    responseMs: null,
    mode: "manual",
    typed: null,
    at: now,
    updatedAt: now,
    deleted: false,
  };
  void collections.reviews.insert(review);
  const next = scheduleFor(card, [...allReviews(collections).filter((r) => r.id !== review.id), review], readLearning());
  collections.cards.update(card.id, (d) => {
    Object.assign(d, next, { pinned: false, updatedAt: now });
  });
}

/** Fortschritt zurücksetzen: frühere Antworten bleiben im Verlauf, zählen aber nicht mehr. */
export const resetProgress = (collections: Collections, card: CardRow) => reschedule(collections, card, { resetAt: Date.now() + 1 });

/**
 * Einmalig nach dem Update: Karten ohne Modellwerte aus ihrer Historie berechnen.
 * Liefert die Anzahl aktualisierter Karten.
 */
export function migrateSchedules(collections: Collections, cards: CardRow[]): number {
  let n = 0;
  const reviews = allReviews(collections);
  const settings = readLearning();
  for (const card of cards) {
    if (card.deleted || (card.stability !== undefined && !(card.reps > 0 && !card.stability))) continue;
    // Historie (noch) nicht da, z. B. weil der Sync die Lernereignisse erst später liefert: nichts zurücksetzen.
    if (card.reps > 0 && !reviews.some((r) => r.cardId === card.id)) continue;
    const next = scheduleFor(card, reviews, settings);
    collections.cards.update(card.id, (d) => {
      Object.assign(d, next, { ignored: d.ignored ?? false, pinned: d.pinned ?? false, updatedAt: Date.now() });
    });
    n++;
  }
  return n;
}
