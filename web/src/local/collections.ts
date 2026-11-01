import { createCollection } from "@tanstack/db";
import type { SyncEntity } from "@vochat/shared";
import type { LocalStore, Row } from "./localStore";

/**
 * TanStack-DB-Collections als reaktive Sicht auf den LocalStore. Der Sync-Adapter
 * spiegelt den lokalen Speicher in die Collection; Mutationen schreiben zuerst
 * lokal (und landen in der Outbox), die Synchronisation übernimmt die Sync-Engine.
 */
function makeCollection<T extends Row>(store: LocalStore, entity: SyncEntity, userId: string) {
  return createCollection({
    id: `${entity}-${userId}`,
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

export function createUserCollections(store: LocalStore, userId: string) {
  return {
    cards: makeCollection<CardRow>(store, "cards", userId),
    messages: makeCollection<MessageRow>(store, "messages", userId),
  };
}

export type CardRow = Row & {
  lang: string;
  lemma: string;
  lexemeId: number | null;
  gloss: string | null;
  note: string;
  cefr: string | null;
  status: "new" | "learning" | "review" | "mastered";
  ease: number;
  intervalDays: number;
  dueAt: number;
  reps: number;
  lapses: number;
  createdAt: number;
};

export type MessageRow = Row & {
  role: "user" | "assistant";
  kind: "text" | "lookup" | "system";
  body: string;
  payload: unknown;
  createdAt: number;
};

export type Collections = ReturnType<typeof createUserCollections>;
