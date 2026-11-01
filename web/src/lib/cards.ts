import { newSchedule, type Cefr, type LangCode, type LexemeSummary } from "@vochat/shared";
import type { Collections, CardRow } from "../local/collections";
import { newId } from "./ids";

/** Legt eine neue Lernkarte aus einem Wörterbuch-Eintrag an (lokal, sofort sichtbar). */
export function addCardFromLexeme(collections: Collections, lexeme: LexemeSummary, lang: LangCode): void {
  const now = Date.now();
  const schedule = newSchedule(now);
  const row: CardRow = {
    id: newId(),
    lang,
    lemma: lexeme.lemma,
    lexemeId: lexeme.id,
    gloss: lexeme.gloss,
    note: "",
    cefr: (lexeme.cefr as Cefr | null) ?? null,
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

export const hasCardFor = (cards: CardRow[], lexemeId: number): boolean =>
  cards.some((c) => !c.deleted && c.lexemeId === lexemeId);
