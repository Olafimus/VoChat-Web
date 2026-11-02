import { useEffect, useMemo } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { goalProgress, knownWords, type Goal, type GoalProgress, type GoalTemplate } from "@vochat/shared";
import { useSession } from "../session";
import type { CardRow, Collections, GoalRow, MediaCollectionRow, ReviewRow } from "../local/collections";
import { startOfToday } from "./learning";
import { newId } from "./ids";

export interface GoalView {
  goal: GoalRow;
  progress: GoalProgress;
  collectionTitle: string | null;
}

const DAY = 86_400_000;

/** Alle Ziele mit aktuellem Fortschritt; erreichte Ziele bekommen einmalig `completedAt`. */
export function useGoals(): { all: GoalView[]; active: GoalView[]; finished: GoalView[]; cards: CardRow[]; own: MediaCollectionRow[] } {
  const { collections } = useSession();
  const goals = (useLiveQuery(() => collections.goals).data ?? []) as GoalRow[];
  const cards = (useLiveQuery(() => collections.cards).data ?? []) as CardRow[];
  const reviews = (useLiveQuery(() => collections.reviews).data ?? []) as ReviewRow[];
  const own = (useLiveQuery(() => collections.collections).data ?? []) as MediaCollectionRow[];

  const all = useMemo(() => {
    const now = Date.now();
    const ctx = {
      cards: cards.map((c) => ({ ...c, lexemeId: c.lexemeId, createdAt: c.createdAt })),
      reviews: reviews.map((r) => ({ at: r.at, manual: r.mode === "manual", deleted: r.deleted })),
      collections: own.map((c) => ({ id: c.id, title: c.title, items: c.items, deleted: c.deleted })),
      now,
      dayStart: startOfToday,
    };
    return goals
      .filter((g) => !g.deleted)
      .map((g) => ({
        goal: g,
        progress: goalProgress(g as unknown as Goal, ctx),
        collectionTitle: g.collectionId ? (own.find((c) => c.id === g.collectionId)?.title ?? null) : null,
      }));
  }, [goals, cards, reviews, own]);

  // Erreicht: Zeitpunkt festhalten (bleibt „erreicht“, auch wenn Wörter später wieder vergessen werden).
  useEffect(() => {
    for (const v of all) {
      if (v.progress.reached && v.goal.completedAt === null) {
        collections.goals.update(v.goal.id, (d) => {
          d.completedAt = Date.now();
          d.updatedAt = Date.now();
        });
      }
    }
  }, [all, collections]);

  const byDeadline = (a: GoalView, b: GoalView) => (a.goal.deadline ?? Infinity) - (b.goal.deadline ?? Infinity) || b.goal.createdAt - a.goal.createdAt;
  const active = all.filter((v) => !v.goal.archived && v.goal.completedAt === null).sort(byDeadline);
  const finished = all.filter((v) => v.goal.archived || v.goal.completedAt !== null).sort((a, b) => (b.goal.completedAt ?? b.goal.updatedAt) - (a.goal.completedAt ?? a.goal.updatedAt));
  return { all, active, finished, cards, own };
}

export interface GoalDraft {
  title: string;
  kind: Goal["kind"];
  target: number;
  lang: string | null;
  collectionId: string | null;
  deadline: number | null;
  items: string[];
  template: string | null;
  difficulty: Goal["difficulty"];
}

export function draftFromTemplate(t: GoalTemplate, lang: string | null, now = Date.now()): GoalDraft {
  return {
    title: t.title,
    kind: t.kind,
    target: t.target,
    lang: t.kind === "streak" || t.kind === "reviews" || t.kind === "checklist" ? null : lang,
    collectionId: null,
    deadline: t.days === null ? null : startOfToday(now) + t.days * DAY + DAY - 1,
    items: t.items ?? [],
    template: t.id,
    difficulty: t.difficulty,
  };
}

/** Neues Ziel speichern. Für „neue Wörter“ wird der heutige Stand als Ausgangswert gemerkt. */
export function createGoal(collections: Collections, cards: CardRow[], d: GoalDraft): string {
  const now = Date.now();
  const row: GoalRow = {
    id: newId(),
    title: d.title.trim(),
    kind: d.kind,
    target: Math.max(1, Math.round(d.target)),
    lang: d.lang,
    collectionId: d.kind === "collection" ? d.collectionId : null,
    baseline: d.kind === "words_new" ? knownWords(cards, d.lang) : 0,
    items: d.kind === "checklist" ? d.items.filter((t) => t.trim()).map((text) => ({ id: newId(), text: text.trim(), done: false, doneAt: null })) : [],
    startAt: now,
    deadline: d.deadline,
    completedAt: null,
    archived: false,
    template: d.template,
    difficulty: d.difficulty,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  void collections.goals.insert(row);
  return row.id;
}

export function updateGoal(collections: Collections, id: string, patch: (d: GoalRow) => void): void {
  collections.goals.update(id, (d) => {
    patch(d);
    d.updatedAt = Date.now();
  });
}
