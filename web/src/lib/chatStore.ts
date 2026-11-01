import { useSyncExternalStore } from "react";
import { ApiError, chat, type ChatMessage } from "../api/client";
import { newId } from "./ids";

/**
 * Nachrichten je Chat im Speicher (älteste zuerst), mit optimistischem Senden: eine Nachricht
 * erscheint sofort, wird mit Client-ID gesendet (idempotent) und bei Fehlern als „nicht gesendet“
 * markiert. Echtzeit-Ereignisse laden neue oder geänderte Nachrichten gezielt nach.
 */
export type LocalMessage = ChatMessage & { pending?: "sending" | "failed"; localUrl?: string; retry?: () => Promise<void> };

interface ConvState {
  messages: LocalMessage[];
  /** Ältere Nachrichten vorhanden? */
  hasMore: boolean;
  loadingOlder: boolean;
  loaded: boolean;
  version: number;
}

const PAGE = 50;
const states = new Map<string, ConvState>();
const listeners = new Map<string, Set<() => void>>();

const empty = (): ConvState => ({ messages: [], hasMore: true, loadingOlder: false, loaded: false, version: 0 });
const get = (id: string) => {
  let s = states.get(id);
  if (!s) states.set(id, (s = empty()));
  return s;
};
function set(id: string, patch: Partial<ConvState>) {
  const prev = get(id);
  states.set(id, { ...prev, ...patch, version: prev.version + 1 });
  listeners.get(id)?.forEach((fn) => fn());
}

export function useConversation(id: string): ConvState {
  return useSyncExternalStore(
    (fn) => {
      let set_ = listeners.get(id);
      if (!set_) listeners.set(id, (set_ = new Set()));
      set_.add(fn);
      return () => set_!.delete(fn);
    },
    () => get(id),
  );
}

/** Nachrichten zusammenführen: nach ID, ausstehende (ohne ID vom Server) über die Client-ID ersetzen. */
function merge(current: LocalMessage[], incoming: ChatMessage[]): LocalMessage[] {
  const byId = new Map<number, LocalMessage>();
  const pending: LocalMessage[] = [];
  for (const m of current) (m.id > 0 ? byId.set(m.id, m) : pending.push(m));
  for (const m of incoming) byId.set(m.id, m);
  const confirmedClientIds = new Set(incoming.map((m) => m.clientId).filter(Boolean));
  const stillPending = pending.filter((p) => !confirmedClientIds.has(p.clientId));
  return [...[...byId.values()].sort((a, b) => a.id - b.id), ...stillPending];
}

export async function loadLatest(token: string, id: string): Promise<void> {
  const page = await chat.messages(token, id, { limit: PAGE });
  const s = get(id);
  set(id, { messages: merge(s.messages, page.reverse()), hasMore: s.loaded ? s.hasMore : page.length === PAGE, loaded: true });
}

export async function loadOlder(token: string, id: string): Promise<number> {
  const s = get(id);
  if (s.loadingOlder || !s.hasMore) return 0;
  const oldest = s.messages.find((m) => m.id > 0);
  if (!oldest) return 0;
  set(id, { loadingOlder: true });
  try {
    const page = await chat.messages(token, id, { before: oldest.id, limit: PAGE });
    set(id, { messages: merge(get(id).messages, page.reverse()), hasMore: page.length === PAGE, loadingOlder: false });
    return page.length;
  } catch {
    set(id, { loadingOlder: false });
    return 0;
  }
}

export async function loadNewer(token: string, id: string): Promise<void> {
  const s = get(id);
  if (!s.loaded) return;
  const newest = [...s.messages].reverse().find((m) => m.id > 0);
  const page = await chat.messages(token, id, newest ? { after: newest.id, limit: 100 } : { limit: PAGE });
  if (page.length) set(id, { messages: merge(get(id).messages, newest ? page : page.reverse()) });
}

export async function refreshMessages(token: string, id: string, ids: number[]): Promise<void> {
  const s = get(id);
  const known = ids.filter((x) => s.messages.some((m) => m.id === x));
  if (!known.length) return;
  const page = await chat.messages(token, id, { ids: known });
  set(id, { messages: merge(get(id).messages, page) });
}

function optimistic(id: string, me: string, partial: Partial<LocalMessage>): LocalMessage {
  const msg: LocalMessage = {
    id: -Date.now() - Math.random(),
    conversationId: id,
    authorId: me,
    kind: "text",
    body: "",
    replyTo: null,
    media: null,
    correction: null,
    reactions: [],
    createdAt: Date.now(),
    editedAt: null,
    deleted: false,
    clientId: newId(),
    pending: "sending",
    ...partial,
  };
  set(id, { messages: [...get(id).messages, msg] });
  return msg;
}

function markFailed(id: string, clientId: string | null, retry: () => Promise<void>) {
  set(id, { messages: get(id).messages.map((m) => (m.clientId === clientId && m.pending ? { ...m, pending: "failed", retry } : m)) });
}

export function sendText(token: string, id: string, me: string, body: string, replyTo: ChatMessage | null): void {
  const msg = optimistic(id, me, {
    body,
    replyTo: replyTo ? { id: replyTo.id, authorId: replyTo.authorId, preview: replyTo.body.slice(0, 120) } : null,
  });
  const attempt = async () => {
    set(id, { messages: get(id).messages.map((m) => (m.clientId === msg.clientId ? { ...m, pending: "sending" } : m)) });
    try {
      const saved = await chat.send(token, id, { body, replyTo: replyTo?.id ?? null, clientId: msg.clientId! });
      set(id, { messages: merge(get(id).messages, [saved]) });
    } catch (e) {
      markFailed(id, msg.clientId, attempt);
      if (!(e instanceof ApiError) || e.status !== 0) throw e;
    }
  };
  void attempt().catch(() => undefined);
}

export function sendMedia(
  token: string,
  id: string,
  me: string,
  blob: Blob,
  q: { kind: "image" | "voice"; caption?: string; durationMs?: number; width?: number; height?: number },
): void {
  const localUrl = URL.createObjectURL(blob);
  const msg = optimistic(id, me, {
    kind: q.kind,
    body: q.caption ?? "",
    localUrl,
    media: { url: localUrl, type: blob.type, width: q.width, height: q.height, durationMs: q.durationMs },
  });
  const attempt = async () => {
    set(id, { messages: get(id).messages.map((m) => (m.clientId === msg.clientId ? { ...m, pending: "sending" } : m)) });
    try {
      const saved = await chat.sendMedia(token, id, blob, { ...q, clientId: msg.clientId! });
      set(id, { messages: merge(get(id).messages, [saved]) });
      setTimeout(() => URL.revokeObjectURL(localUrl), 30_000);
    } catch {
      markFailed(id, msg.clientId, attempt);
    }
  };
  void attempt();
}

export function discardFailed(id: string, clientId: string | null): void {
  set(id, { messages: get(id).messages.filter((m) => !(m.clientId === clientId && m.pending === "failed")) });
}

/** Lokale Änderung (z. B. Reaktion) sofort anzeigen; der Server bestätigt per Ereignis. */
export function patchMessage(id: string, messageId: number, fn: (m: LocalMessage) => LocalMessage): void {
  set(id, { messages: get(id).messages.map((m) => (m.id === messageId ? fn(m) : m)) });
}

/** Für Tests/Seeding: Chat leeren (z. B. beim Abmelden). */
export function clearChats(): void {
  states.clear();
}
