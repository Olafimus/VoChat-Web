import { newSchedule, reviewCard, type Grade, type LangCode, type LexemeSummary, type Mode, type Cefr } from "@vochat/shared";
import type { Collections, CardRow } from "../local/collections";
import { newId } from "./ids";

export interface NewCard {
  lang: LangCode;
  lemma: string;
  lexemeId: number | null;
  gloss: string | null;
  cefr: Cefr | null;
}

/** Legt eine Lernkarte an (lokal, sofort sichtbar). */
export function addCard(collections: Collections, input: NewCard): void {
  const now = Date.now();
  const schedule = newSchedule(now);
  const row: CardRow = {
    id: newId(),
    lang: input.lang,
    lemma: input.lemma,
    lexemeId: input.lexemeId,
    gloss: input.gloss,
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
}

export function addCardFromLexeme(collections: Collections, lexeme: LexemeSummary, lang: LangCode): void {
  addCard(collections, { lang, lemma: lexeme.lemma, lexemeId: lexeme.id, gloss: lexeme.gloss, cefr: (lexeme.cefr as Cefr | null) ?? null });
}

export const hasCardFor = (cards: CardRow[], lexemeId: number): boolean =>
  cards.some((c) => !c.deleted && c.lexemeId === lexemeId);

export const hasCardWord = (cards: CardRow[], lang: string, lemma: string): boolean => {
  const k = lemma.trim().toLocaleLowerCase("de");
  return cards.some((c) => !c.deleted && c.lang === lang && c.lemma.trim().toLocaleLowerCase("de") === k);
};

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
