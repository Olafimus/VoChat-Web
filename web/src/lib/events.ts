import { apiUrl } from "../api/client";

/**
 * Echtzeit-Ereignisse vom Server (Server-Sent Events über fetch, damit der Bearer-Token im Header
 * bleibt). Verbindet sich automatisch neu (mit wachsender Pause) und meldet „wieder verbunden“,
 * damit Listen fehlende Nachrichten nachladen können.
 */
export type ChatEvent =
  | { type: "message"; conversationId: string; messageId: number }
  | { type: "update"; conversationId: string; messageId: number }
  | { type: "read"; conversationId: string; userId: string; messageId: number }
  | { type: "conversation"; conversationId: string }
  | { type: "reconnected" };

type Listener = (e: ChatEvent) => void;
const listeners = new Set<Listener>();
let controller: AbortController | null = null;
let currentToken: string | null = null;

export function onChatEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const emit = (e: ChatEvent) => listeners.forEach((fn) => fn(e));

export function connectEvents(token: string | null): void {
  if (token === currentToken) return;
  controller?.abort();
  controller = null;
  currentToken = token;
  if (!token) return;
  const ctrl = new AbortController();
  controller = ctrl;
  void run(token, ctrl.signal);
}

async function run(token: string, signal: AbortSignal) {
  let delay = 1000;
  let first = true;
  while (!signal.aborted) {
    try {
      const res = await fetch(apiUrl("/events"), { headers: { authorization: `Bearer ${token}`, accept: "text/event-stream" }, signal });
      if (res.status === 401) return;
      if (!res.ok || !res.body) throw new Error(String(res.status));
      if (!first) emit({ type: "reconnected" });
      first = false;
      delay = 1000;
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const event = /^event: (.*)$/m.exec(chunk)?.[1];
          const data = /^data: (.*)$/m.exec(chunk)?.[1];
          if (event === "chat" && data) {
            try {
              emit(JSON.parse(data) as ChatEvent);
            } catch {
              /* ungültig – ignorieren */
            }
          }
        }
      }
    } catch {
      if (signal.aborted) return;
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(30_000, delay * 2);
  }
}
