import { createCollection } from "@tanstack/db";
import type { SyncEntity } from "@vochat/shared";
import type { LocalStore, Row } from "./localStore";

/**
 * TanStack-DB-Collections als reaktive Sicht auf den LocalStore. Der Sync-Adapter
 * spiegelt den lokalen Speicher in die Collection; Mutationen schreiben zuerst
 * lokal (und landen in der Outbox), die Synchronisation übernimmt die Sync-Engine.
 */
function makeCollection<T extends Row>(store: LocalStore, entity: SyncEntity) {
  return createCollection({
    id: `${entity}-device`,
    getKey: (row: T) => row.id,
    sync: {
      sync: ({ begin, write, commit, markReady }) => {
        const known = new Set<string>();

        const apply = (rows: Row[]) => {
          if (rows.length === 0) return;
          begin();
          for (const row of rows) {
            if (known.has(row.id)) write({ type: "update", value: row as T });
            else {
              known.add(row.id);
              write({ type: "insert", value: row as T });
            }
          }
          commit();
        };

        apply(store.all(entity));
        markReady();
        return store.subscribe(entity, apply);
      },
    },
    onInsert: async ({ transaction }) => {
      for (const m of transaction.mutations) store.upsertLocal(entity, m.modified as Row);
    },
    onUpdate: async ({ transaction }) => {
      for (const m of transaction.mutations) store.upsertLocal(entity, m.modified as Row);
    },
  });
}

/** Collections des Geräts. Unabhängig vom Konto, damit sie beim Anmelden nicht neu entstehen. */
export function createDeviceCollections(store: LocalStore) {
  return {
    cards: makeCollection<CardRow>(store, "cards"),
    messages: makeCollection<MessageRow>(store, "messages"),
    reviews: makeCollection<ReviewRow>(store, "reviews"),
    collections: makeCollection<MediaCollectionRow>(store, "collections"),
  };
}

export type CardRow = Row & {
  lang: string;
  lemma: string;
  lexemeId: number | null;
  gloss: string | null;
  pronunciation: string | null;
  /** Vom Nutzer geänderte Felder; diese überschreibt der Abgleich mit dem Wörterbuch nicht. */
  custom: ("lemma" | "gloss" | "pronunciation" | "cefr")[];
  note: string;
  cefr: string | null;
  status: "new" | "learning" | "review" | "mastered";
  ease: number;
  intervalDays: number;
  dueAt: number;
  reps: number;
  lapses: number;
  createdAt: number;
  /** Gedächtnismodell (aus der Historie berechnet), siehe @vochat/shared memory.ts. Ältere Zeilen: undefined. */
  stability?: number;
  difficulty?: number;
  lastReviewAt?: number | null;
  ignored?: boolean;
  retention?: number | null;
  pinned?: boolean;
  resetAt?: number | null;
  rank?: number | null;
  origin?: string | null;
  pendingUpdate?: { fields: Partial<Record<"gloss" | "pronunciation" | "cefr", { from: string | null; to: string | null }>>; at: number } | null;
  ignoredUpdate?: string | null;
};

export type MessageRow = Row & {
  role: "user" | "assistant";
  kind: "text" | "lookup" | "extract" | "system";
  body: string;
  payload: unknown;
  createdAt: number;
  editedAt: number | null;
};

export type ReviewRow = Row & {
  cardId: string;
  lang: string;
  lemma: string;
  outcome: "right" | "wrong";
  grade?: "again" | "hard" | "good" | "easy" | null;
  responseMs?: number | null;
  mode: "flip" | "reverse" | "type" | "manual";
  typed: string | null;
  at: number;
};

export type MediaCollectionRow = Row & {
  kind: "path" | "media";
  mediaType: "book" | "song" | "film" | "series" | "other" | null;
  title: string;
  description: string;
  lang: string;
  level: string | null;
  visibility: "private" | "public";
  ownerName: string;
  items: { lemma: string; lang: string; lexemeId: number | null; gloss: string | null; pronunciation?: string | null; cefr: string | null }[];
  createdAt: number;
};

export type Collections = ReturnType<typeof createDeviceCollections>;
