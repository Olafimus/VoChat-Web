import { lemmaKey, newSchedule, reviewCard, type Grade, type LangCode, type LexemeSummary, type Mode, type Cefr } from "@vochat/shared";
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
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  void collections.cards.insert(row);
  return row.id;
}

export function addCardFromLexeme(collections: Collections, lexeme: LexemeSummary, lang: LangCode): void {
  addCard(collections, {
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
  input: { lang: LangCode; lemma: string; gloss?: string | null; pronunciation?: string | null },
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

/**
 * Antwort auswerten: aktualisiert den Zeitplan (SRS) und protokolliert das Lernereignis.
 * Die Protokolle speisen Trefferquoten und Lernpakete.
 */
export function recordAnswer(
  collections: Collections,
  card: CardRow,
  args: { mode: Mode; grade: Grade; typed: string | null },
): void {
  const now = Date.now();
  const next = reviewCard(card, args.grade, now);
  collections.cards.update(card.id, (draft) => {
    Object.assign(draft, next, { updatedAt: now });
  });
  void collections.reviews.insert({
    id: newId(),
    cardId: card.id,
    lang: card.lang,
    lemma: card.lemma,
    outcome: args.grade === "again" ? "wrong" : "right",
    mode: args.mode,
    typed: args.typed,
    at: now,
    updatedAt: now,
    deleted: false,
  });
}
