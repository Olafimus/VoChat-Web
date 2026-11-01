import { useSyncExternalStore } from "react";
import { createCollection } from "@tanstack/db";
import { clear, createStore, delMany, entries, get as idbGet, set as idbSet, setMany } from "idb-keyval";
import { ApiError, chat, type ChatMessage, type ConversationView } from "../api/client";
import { newId } from "./ids";

/**
 * Chat-Nachrichten in einer TanStack-DB-Collection, gespeichert in IndexedDB:
 * - Chats öffnen sofort aus dem lokalen Speicher (auch offline), der Server liefert nur Neues nach.
 * - Optimistisches Senden: die Nachricht steht sofort in der Collection (ausstehend) und wird mit
 *   Client-ID gesendet (idempotent). Fehlgeschlagene bleiben gespeichert und lassen sich erneut senden –
 *   auch nach einem Neustart der App.
 * - Die Oberfläche liest per `useLiveQuery` (gefiltert nach Chat, sortiert) – inkrementell, auch bei
 *   zehntausenden Nachrichten.
 */
export type LocalMessage = ChatMessage & {
  /** Stabiler Schlüssel: Client-ID (eigene) oder Server-ID. */
  key: string;
  /** Sortierung: Server-ID; ausstehende ans Ende (nach Zeit). */
  sort: number;
  pending?: "sending" | "failed";
  /** Für ausstehende Medien: Datei bis zum Hochladen. */
  blob?: Blob;
  localUrl?: string;
  mediaQuery?: MediaQuery;
};
type MediaQuery = { kind: "image" | "voice"; caption?: string; durationMs?: number; width?: number; height?: number };

const PENDING_BASE = 1e15;
const keyOf = (m: Pick<ChatMessage, "clientId" | "id">) => (m.clientId ? `c${m.clientId}` : `m${m.id}`);
const toRow = (m: ChatMessage, extra: Partial<LocalMessage> = {}): LocalMessage => ({
  ...m,
  key: keyOf(m),
  sort: m.id > 0 ? m.id : PENDING_BASE + m.createdAt,
  // Updates werden mit der vorhandenen Zeile zusammengeführt: lokale Felder ausdrücklich zurücksetzen
  pending: undefined,
  blob: undefined,
  localUrl: undefined,
  mediaQuery: undefined,
  ...extra,
});

const db = createStore("vochat-chat", "messages");
const meta = createStore("vochat-chat-meta", "meta");

type SyncApi = {
  begin: () => void;
  write: (m: { type: "insert" | "update" | "delete"; value: LocalMessage }) => void;
  commit: () => void;
};
let api: SyncApi | null = null;
const known = new Map<string, LocalMessage>();
let ready: Promise<void>;
let markLoaded: () => void;
ready = new Promise((r) => (markLoaded = r));

export const chatMessages = createCollection<LocalMessage, string>({
  id: "chat-messages",
  getKey: (m) => m.key,
  sync: {
    sync: ({ begin, write, commit, markReady }) => {
      api = { begin, write, commit };
      void entries<string, LocalMessage>(db)
        .then((rows) => {
          begin();
          for (const [, row] of rows) {
            // Nach einem Neustart ist nichts mehr „unterwegs“: ausstehende gelten als fehlgeschlagen.
            const value = row.pending === "sending" ? { ...row, pending: "failed" as const } : row;
            known.set(value.key, value);
            write({ type: "insert", value });
          }
          commit();
        })
        .catch(() => undefined)
        .finally(() => {
          markReady();
          markLoaded();
        });
    },
  },
});
// Sync sofort starten (nicht erst bei der ersten Abfrage), damit Schreibzugriffe nie verloren gehen.
void chatMessages.preload?.();

// Speichern in IndexedDB gebündelt (alle Änderungen eines Frames in einem Schreibvorgang)
let pendingWrites = new Map<string, LocalMessage | null>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
function persist(key: string, value: LocalMessage | null) {
  pendingWrites.set(key, value);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    const batch = pendingWrites;
    pendingWrites = new Map();
    flushTimer = null;
    const puts: [string, LocalMessage][] = [];
    const dels: string[] = [];
    for (const [k, v] of batch) {
      if (v) {
        // Blobs von bereits gesendeten Medien nicht speichern
        const { localUrl: _u, ...rest } = v;
        puts.push([k, rest as LocalMessage]);
      } else dels.push(k);
    }
    if (puts.length) void setMany(puts, db).catch(() => undefined);
    if (dels.length) void delMany(dels, db).catch(() => undefined);
  }, 50);
}

async function upsert(rows: LocalMessage[], remove: string[] = []): Promise<void> {
  await ready;
  if (!api || (rows.length === 0 && remove.length === 0)) return;
  api.begin();
  for (const value of rows) {
    api.write({ type: known.has(value.key) ? "update" : "insert", value });
    known.set(value.key, value);
    persist(value.key, value);
  }
  for (const key of remove) {
    const value = known.get(key);
    if (!value) continue;
    api.write({ type: "delete", value });
    known.delete(key);
    persist(key, null);
  }
  api.commit();
}

/** Vom Server geladene Nachrichten übernehmen (ersetzt ausstehende mit gleicher Client-ID). */
function mergeServer(list: ChatMessage[]) {
  return upsert(list.map((m) => toRow(m)));
}

// ---- Zustand je Chat (Paging) ---------------------------------------------------

interface ConvState {
  hasMore: boolean;
  loadingOlder: boolean;
  loaded: boolean;
}
const PAGE = 50;
const states = new Map<string, ConvState>();
const listeners = new Map<string, Set<() => void>>();
// Stabile Referenz je Chat (useSyncExternalStore verlangt identische Snapshots ohne Änderung)
const getState = (id: string): ConvState => {
  let s = states.get(id);
  if (!s) states.set(id, (s = { hasMore: true, loadingOlder: false, loaded: false }));
  return s;
};
function setState(id: string, patch: Partial<ConvState>) {
  states.set(id, { ...getState(id), ...patch });
  listeners.get(id)?.forEach((fn) => fn());
}
export function useConversationState(id: string): ConvState {
  return useSyncExternalStore(
    (fn) => {
      let set = listeners.get(id);
      if (!set) listeners.set(id, (set = new Set()));
      set.add(fn);
      return () => set!.delete(fn);
    },
    () => getState(id),
  );
}

const inConv = (id: string) => [...known.values()].filter((m) => m.conversationId === id);
const newestServerId = (id: string) => Math.max(0, ...inConv(id).filter((m) => m.id > 0).map((m) => m.id));
const oldestServerId = (id: string) => Math.min(Number.MAX_SAFE_INTEGER, ...inConv(id).filter((m) => m.id > 0).map((m) => m.id));

/** Beim Öffnen: lokal Vorhandenes zeigt sofort; vom Server nur Neueres holen (oder die letzte Seite). */
export async function openConversation(token: string, id: string): Promise<void> {
  await ready;
  const newest = newestServerId(id);
  if (newest > 0) {
    // Lücken auffüllen: bis zu 500 neuere Nachrichten seitenweise
    for (let i = 0, after = newest; i < 5; i++) {
      const page = await chat.messages(token, id, { after, limit: 100 });
      await mergeServer(page);
      if (page.length < 100) break;
      after = page[page.length - 1].id;
    }
    // Ob es ältere gibt, zeigt erst das Nachladen beim Hochscrollen.
    setState(id, { loaded: true, hasMore: getState(id).loaded ? getState(id).hasMore : true });
  } else {
    const page = await chat.messages(token, id, { limit: PAGE });
    await mergeServer(page);
    setState(id, { loaded: true, hasMore: page.length === PAGE });
  }
}

export async function loadOlder(token: string, id: string): Promise<number> {
  const s = getState(id);
  if (s.loadingOlder || !s.hasMore) return 0;
  const oldest = oldestServerId(id);
  if (oldest === Number.MAX_SAFE_INTEGER) return 0;
  setState(id, { loadingOlder: true });
  try {
    const page = await chat.messages(token, id, { before: oldest, limit: PAGE });
    await mergeServer(page);
    setState(id, { hasMore: page.length === PAGE, loadingOlder: false });
    return page.length;
  } catch {
    setState(id, { loadingOlder: false });
    return 0;
  }
}

export async function loadNewer(token: string, id: string): Promise<void> {
  const newest = newestServerId(id);
  const page = await chat.messages(token, id, newest ? { after: newest, limit: 100 } : { limit: PAGE });
  await mergeServer(page);
}

export async function refreshMessages(token: string, id: string, ids: number[]): Promise<void> {
  const page = await chat.messages(token, id, { ids });
  await mergeServer(page);
}

// ---- Senden ------------------------------------------------------------------------

function optimistic(id: string, me: string, partial: Partial<LocalMessage>): LocalMessage {
  const clientId = newId();
  const now = Date.now();
  const row: LocalMessage = {
    id: -now,
    conversationId: id,
    authorId: me,
    kind: "text",
    body: "",
    replyTo: null,
    media: null,
    correction: null,
    reactions: [],
    createdAt: now,
    editedAt: null,
    deleted: false,
    clientId,
    key: `c${clientId}`,
    sort: PENDING_BASE + now,
    pending: "sending",
    ...partial,
  };
  void upsert([row]);
  return row;
}

const setPending = (row: LocalMessage, pending: LocalMessage["pending"]) => upsert([{ ...(known.get(row.key) ?? row), pending }]);

async function deliver(token: string, row: LocalMessage): Promise<void> {
  await setPending(row, "sending");
  try {
    const saved =
      row.kind === "text"
        ? await chat.send(token, row.conversationId, { body: row.body, replyTo: row.replyTo?.id ?? null, clientId: row.clientId! })
        : await chat.sendMedia(token, row.conversationId, row.blob!, { ...row.mediaQuery!, clientId: row.clientId! });
    await upsert([toRow(saved)]);
    if (row.localUrl) setTimeout(() => URL.revokeObjectURL(row.localUrl!), 30_000);
  } catch (e) {
    await setPending(row, "failed");
    if (e instanceof ApiError && e.status !== 0 && e.status < 500) throw e;
  }
}

export function sendText(token: string, id: string, me: string, body: string, replyTo: ChatMessage | null): void {
  const row = optimistic(id, me, {
    body,
    replyTo: replyTo ? { id: replyTo.id, authorId: replyTo.authorId, preview: replyTo.body.slice(0, 120) } : null,
  });
  void deliver(token, row).catch(() => undefined);
}

export function sendMedia(token: string, id: string, me: string, blob: Blob, q: MediaQuery): void {
  const localUrl = URL.createObjectURL(blob);
  const row = optimistic(id, me, {
    kind: q.kind,
    body: q.caption ?? "",
    blob,
    localUrl,
    mediaQuery: q,
    media: { url: localUrl, type: blob.type, width: q.width, height: q.height, durationMs: q.durationMs },
  });
  void deliver(token, row).catch(() => undefined);
}

/** Fehlgeschlagene Nachricht erneut senden (auch nach Neustart – Text und Blob liegen in IndexedDB). */
export function retry(token: string, row: LocalMessage): void {
  if (row.kind !== "text" && row.blob && !row.localUrl) {
    const localUrl = URL.createObjectURL(row.blob);
    row = { ...row, localUrl, media: row.media ? { ...row.media, url: localUrl } : row.media };
  }
  void deliver(token, row).catch(() => undefined);
}

export function discardFailed(row: LocalMessage): void {
  void upsert([], [row.key]);
}

/** Lokale Änderung (z. B. Reaktion) sofort anzeigen; der Server bestätigt per Ereignis. */
export function patchMessage(row: LocalMessage, fn: (m: LocalMessage) => LocalMessage): void {
  const current = known.get(row.key) ?? row;
  void upsert([fn(current)]);
}

// ---- Chat-Liste (für die Offline-Anzeige zwischengespeichert) ----------------------

export const cachedConversations = () => idbGet<ConversationView[]>("conversations", meta).catch(() => undefined);
export const cacheConversations = (list: ConversationView[]) => void idbSet("conversations", list, meta).catch(() => undefined);

/** Beim Abmelden oder Kontowechsel: alles Lokale zum Chat löschen. */
export async function clearChats(): Promise<void> {
  await ready;
  await upsert([], [...known.keys()]);
  states.clear();
  await Promise.all([clear(db), clear(meta)]).catch(() => undefined);
}
