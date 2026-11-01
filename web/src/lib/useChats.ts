import { useEffect, useState } from "react";
import { chat, type ConversationView } from "../api/client";
import { onChatEvent } from "./events";
import { cacheConversations, cachedConversations } from "./chatStore";

/** Chat-Liste, aktualisiert sich bei Echtzeit-Ereignissen (gebündelt, höchstens alle 500 ms). */
export function useConversations(token: string | null): { list: ConversationView[] | null; error: boolean; reload: () => void } {
  const [list, setList] = useState<ConversationView[] | null>(null);
  const [error, setError] = useState(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!token) return setList(null);
    let live = true;
    // Sofort aus dem Zwischenspeicher, dann frisch vom Server
    void cachedConversations().then((cached) => live && cached && setList((cur) => cur ?? cached));
    chat
      .conversations(token)
      .then((l) => {
        if (!live) return;
        setList(l);
        setError(false);
        cacheConversations(l);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [token, tick]);
  useEffect(() => {
    if (!token) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = onChatEvent(() => {
      if (t) return;
      t = setTimeout(() => {
        t = null;
        setTick((x) => x + 1);
      }, 500);
    });
    return () => {
      off();
      if (t) clearTimeout(t);
    };
  }, [token]);
  return { list, error, reload: () => setTick((x) => x + 1) };
}
