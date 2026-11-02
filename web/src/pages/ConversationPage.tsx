import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { LANGUAGES, type LangCode, type LexemeSummary } from "@vochat/shared";
import { ApiError, chat, extract, type ConversationView } from "../api/client";
import { useSession } from "../session";
import { useActiveLang } from "../lib/lang";
import { onChatEvent } from "../lib/events";
import {
  chatMessages,
  discardFailed,
  loadNewer,
  loadOlder,
  openConversation,
  patchMessage,
  refreshMessages,
  retry,
  sendMedia,
  sendText,
  useConversationState,
  cachedConversations,
  type LocalMessage,
} from "../lib/chatStore";
import { eq } from "@tanstack/db";
import { prepareImage } from "../lib/images";
import { canRecord, startRecording, type ActiveRecorder } from "../lib/recorder";
import { addCardFromLexeme, addOwnWord, hasCardWord } from "../lib/cards";
import { useLiveQuery } from "@tanstack/react-db";
import type { CardRow } from "../local/collections";
import { Avatar } from "../components/Avatar";
import { EmojiPicker } from "../components/chat/EmojiPicker";
import { MessageBubble, type BubbleActions } from "../components/chat/MessageBubble";
import { WordView } from "../components/WordView";
import { DiffText as DiffPreview } from "../components/DiffText";
import { IconAttach, IconBack, IconCheck, IconClose, IconDown, IconEmoji, IconMic, IconNotes, IconSend } from "../components/icons";

const MAX_VOICE_MS = 120_000;
const dayLabel = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return "Heute";
  if (d.toDateString() === yesterday.toDateString()) return "Gestern";
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long", year: d.getFullYear() === today.getFullYear() ? undefined : "numeric" });
};

type Row =
  | { type: "day"; key: string; label: string }
  | { type: "unread"; key: string }
  | { type: "msg"; key: string; m: LocalMessage; showAuthor: boolean };

export function ConversationPage() {
  const { id = "" } = useParams();
  const { token, user } = useSession();
  const state = useConversationState(id);
  // Nachrichten live aus der lokalen Collection (IndexedDB) – sofort da, auch offline
  const { data: live } = useLiveQuery((q) =>
    q
      .from({ m: chatMessages })
      .where(({ m }) => eq(m.conversationId, id))
      .orderBy(({ m }) => m.sort, "asc"),
  );
  const messages = (live ?? []) as LocalMessage[];
  const [conv, setConv] = useState<ConversationView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<LocalMessage | null>(null);
  const [editing, setEditing] = useState<LocalMessage | null>(null);
  const [correcting, setCorrecting] = useState<LocalMessage | null>(null);
  const [learning, setLearning] = useState<LocalMessage | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const firstUnread = useRef<number | null>(null);
  const me = user.id;

  const loadConv = useCallback(async () => {
    if (!token) return;
    try {
      const list = await chat.conversations(token);
      const found = list.find((c) => c.id === id) ?? null;
      setConv(found);
      if (found && firstUnread.current === null) {
        const mine = found.members.find((m) => m.id === me);
        firstUnread.current = found.unread > 0 && mine ? mine.lastReadId : -1;
      }
      if (!found) setError("Chat nicht gefunden.");
      else setNotice(null);
    } catch (e) {
      // Offline: Name und Mitglieder aus der zwischengespeicherten Chat-Liste
      const cached = (await cachedConversations())?.find((c) => c.id === id) ?? null;
      if (cached) setConv((cur) => cur ?? cached);
      setNotice(e instanceof ApiError && e.status === 0 ? "Offline – du siehst die gespeicherten Nachrichten." : "Chat konnte nicht aktualisiert werden.");
    }
  }, [token, id, me]);

  useEffect(() => {
    if (!token) return;
    void loadConv();
    void openConversation(token, id).catch(() => setNotice("Offline – du siehst die gespeicherten Nachrichten."));
  }, [token, id, loadConv]);

  // Echtzeit: neue/geänderte Nachrichten und Lesestand
  useEffect(() => {
    if (!token) return;
    return onChatEvent((e) => {
      if (e.type === "reconnected") {
        void loadNewer(token, id);
        void loadConv();
        return;
      }
      if (!("conversationId" in e) || e.conversationId !== id) return;
      if (e.type === "message") void loadNewer(token, id);
      else if (e.type === "update") void refreshMessages(token, id, [e.messageId]);
      else if (e.type === "read")
        setConv((c) => (c ? { ...c, members: c.members.map((m) => (m.id === e.userId ? { ...m, lastReadId: Math.max(m.lastReadId, e.messageId) } : m)) } : c));
    });
  }, [token, id, loadConv]);

  const names = useMemo(() => new Map((conv?.members ?? []).map((m) => [m.id, m.name])), [conv]);
  const othersRead = useMemo(() => Math.min(...(conv?.members.filter((m) => m.id !== me).map((m) => m.lastReadId) ?? [0])), [conv, me]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    let lastDay = "";
    let lastAuthor: string | null | undefined;
    let unreadPlaced = false;
    for (const m of messages) {
      const day = new Date(m.createdAt).toDateString();
      if (day !== lastDay) {
        out.push({ type: "day", key: `d${day}`, label: dayLabel(m.createdAt) });
        lastDay = day;
        lastAuthor = undefined;
      }
      if (!unreadPlaced && firstUnread.current !== null && firstUnread.current >= 0 && m.id > firstUnread.current && m.authorId !== me) {
        out.push({ type: "unread", key: "unread" });
        unreadPlaced = true;
      }
      out.push({ type: "msg", key: m.key, m, showAuthor: conv?.kind === "group" && m.authorId !== lastAuthor });
      lastAuthor = m.authorId;
    }
    return out;
  }, [messages, conv?.kind, me]);

  // ---- Virtualisierung ----------------------------------------------------
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.type === "msg" ? 72 : 40),
    getItemKey: (i) => rows[i]?.key ?? i,
    overscan: 10,
  });
  const atBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const anchor = useRef<{ key: string; offset: number } | null>(null);
  const initialScrollDone = useRef(false);

  const scrollToEnd = useCallback(() => {
    if (rows.length === 0) return;
    virtualizer.scrollToIndex(rows.length - 1, { align: "end" });
    // nach dem Messen der Höhen noch einmal exakt ans Ende
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [rows.length, virtualizer]);

  // Erstes Laden: ans Ende springen
  useLayoutEffect(() => {
    if (!initialScrollDone.current && rows.length > 0) {
      initialScrollDone.current = true;
      scrollToEnd();
      setTimeout(scrollToEnd, 50);
    }
  }, [rows.length, scrollToEnd]);

  // Ältere vorne angefügt: Position halten (die vorher oberste Nachricht bleibt, wo sie war)
  const prevLast = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const lastKey = rows[rows.length - 1]?.key;
    if (anchor.current && el) {
      const idx = rows.findIndex((r) => r.key === anchor.current!.key);
      if (idx > 0) {
        const start = virtualizer.measurementsCache[idx]?.start ?? 0;
        el.scrollTop = start - anchor.current.offset;
      }
      anchor.current = null;
    } else if (lastKey !== prevLast.current && initialScrollDone.current) {
      // Neue Nachricht unten: mitscrollen, wenn man unten war oder selbst gesendet hat
      const last = rows[rows.length - 1];
      if (atBottom.current || (last?.type === "msg" && last.m.authorId === me)) scrollToEnd();
      else setShowJump(true);
    }
    prevLast.current = lastKey;
  }, [rows, virtualizer, scrollToEnd, me]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || !token) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    atBottom.current = distance < 120;
    if (atBottom.current) setShowJump(false);
    if (el.scrollTop < 400 && state.hasMore && !state.loadingOlder && state.loaded && initialScrollDone.current) {
      const first = virtualizer.getVirtualItems().find((v) => rows[v.index]?.type === "msg");
      if (first) anchor.current = { key: String(first.key), offset: first.start - el.scrollTop };
      void loadOlder(token, id).then((n) => {
        if (n === 0) anchor.current = null;
      });
    }
  };

  // Gelesen melden, wenn das Ende sichtbar ist
  const lastReadSent = useRef(0);
  useEffect(() => {
    if (!token) return;
    const newest = [...messages].reverse().find((m) => m.id > 0);
    if (!newest || newest.id <= lastReadSent.current) return;
    const t = setTimeout(() => {
      if (atBottom.current && document.visibilityState === "visible") {
        lastReadSent.current = newest.id;
        void chat.read(token, id, newest.id).catch(() => undefined);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [messages, token, id, showJump]);

  // ---- Aktionen ------------------------------------------------------------
  const actions: BubbleActions = useMemo(
    () => ({
      reply: (m) => {
        setEditing(null);
        setReplyTo(m);
      },
      react: (m, emoji) => {
        if (!token) return;
        patchMessage(m, (x) => {
          const has = x.reactions.find((r) => r.emoji === emoji);
          const reactions = has
            ? has.mine
              ? x.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r)).filter((r) => r.count > 0)
              : x.reactions.map((r) => (r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r))
            : [...x.reactions, { emoji, count: 1, mine: true }];
          return { ...x, reactions };
        });
        void chat.react(token, m.id, emoji).catch(() => void refreshMessages(token, id, [m.id]));
      },
      edit: (m) => {
        setReplyTo(null);
        setEditing(m);
      },
      remove: (m) => {
        if (!token || !window.confirm("Nachricht für alle löschen?")) return;
        patchMessage(m, (x) => ({ ...x, deleted: true }));
        void chat.remove(token, m.id).catch(() => void refreshMessages(token, id, [m.id]));
      },
      correct: (m) => setCorrecting(m),
      learn: (m) => setLearning(m),
      openImage: (url) => setLightbox(url),
      retry: (m) => token && retry(token, m),
      jumpTo: (messageId) => {
        const idx = rows.findIndex((r) => r.type === "msg" && r.m.id === messageId);
        if (idx >= 0) virtualizer.scrollToIndex(idx, { align: "center" });
      },
    }),
    [token, id, rows, virtualizer],
  );

  if (!token) return <div className="card">Chats brauchen ein Konto. <Link to="/profile">Jetzt anlegen</Link></div>;

  const others = conv?.members.filter((m) => m.id !== me) ?? [];
  return (
    <div className="conv-page">
      <header className="conv-head">
        <Link to="/chat" className="conv-back" aria-label="Zurück zu den Chats">
          <IconBack size={20} />
        </Link>
        {others[0] && <Avatar name={conv?.kind === "group" ? conv.title : others[0].name} url={conv?.kind === "group" ? null : others[0].avatarUrl} size={32} />}
        <div className="conv-title">
          <b>{conv?.title ?? "…"}</b>
          {conv?.kind === "group" && <span className="muted small">{conv.members.length} Mitglieder</span>}
        </div>
        {conv && (
          <Link to={`/notes/new?chat=${encodeURIComponent(conv.id)}&label=${encodeURIComponent(conv.title)}`} className="conv-back" aria-label="Notiz zu diesem Chat" title="Notiz zu diesem Chat">
            <IconNotes size={19} />
          </Link>
        )}
      </header>
      {error && <div className="error small">{error}</div>}
      {notice && <div className="offline-note small">{notice}</div>}

      <div className="chat-scroll" ref={scrollRef} onScroll={onScroll} role="log" aria-live="polite" aria-label="Nachrichten">
        {state.loadingOlder && <div className="muted small center">Lade ältere Nachrichten …</div>}
        {!state.hasMore && state.loaded && <div className="muted small center chat-start">Anfang des Chats</div>}
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((v) => {
            const row = rows[v.index];
            return (
              <div
                key={v.key}
                data-index={v.index}
                ref={virtualizer.measureElement}
                className="chat-row"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${v.start}px)` }}
              >
                {row.type === "day" ? (
                  <div className="day-sep"><span>{row.label}</span></div>
                ) : row.type === "unread" ? (
                  <div className="unread-sep"><span>Neue Nachrichten</span></div>
                ) : (
                  <MessageBubble
                    m={row.m}
                    mine={row.m.authorId === me}
                    authorName={names.get(row.m.authorId ?? "") ?? "?"}
                    showAuthor={row.showAuthor}
                    read={row.m.id > 0 && row.m.id <= othersRead}
                    correctorName={row.m.correction?.byId ? (names.get(row.m.correction.byId) ?? null) : null}
                    actions={actions}
                  />
                )}
              </div>
            );
          })}
        </div>
        {state.loaded && messages.length === 0 && <div className="muted center chat-empty">Noch keine Nachrichten. Sag hallo!</div>}
      </div>
      {showJump && (
        <button type="button" className="jump-latest" onClick={() => (scrollToEnd(), setShowJump(false))} aria-label="Zu neuen Nachrichten">
          <IconDown size={15} aria-hidden /> Neue Nachrichten
        </button>
      )}

      <Composer
        convId={id}
        me={me}
        replyTo={replyTo}
        editing={editing}
        names={names}
        onDone={() => {
          setReplyTo(null);
          setEditing(null);
        }}
      />

      {correcting && <CorrectDialog m={correcting} onClose={() => setCorrecting(null)} />}
      {learning && <LearnDialog text={learning.body} onClose={() => setLearning(null)} />}
      {lightbox && (
        <div className="lightbox" role="dialog" aria-label="Bild" onClick={() => setLightbox(null)} onKeyDown={(e) => e.key === "Escape" && setLightbox(null)} tabIndex={-1}>
          <img src={lightbox} alt="" />
        </div>
      )}
      {messages.some((m) => m.pending === "failed") && (
        <div className="muted small center">
          Einige Nachrichten wurden nicht gesendet.{" "}
          <button className="link small" onClick={() => messages.filter((m) => m.pending === "failed").forEach((m) => discardFailed(m))}>
            Verwerfen
          </button>
        </div>
      )}
    </div>
  );
}

// ---- Eingabe -----------------------------------------------------------------

function Composer({
  convId,
  me,
  replyTo,
  editing,
  names,
  onDone,
}: {
  convId: string;
  me: string;
  replyTo: LocalMessage | null;
  editing: LocalMessage | null;
  names: Map<string, string>;
  onDone: () => void;
}) {
  const { token } = useSession();
  const [text, setText] = useState("");
  const [emoji, setEmoji] = useState(false);
  const [rec, setRec] = useState<ActiveRecorder | null>(null);
  const [recMs, setRecMs] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const cancelRec = useRef(false);

  useEffect(() => {
    if (editing) setText(editing.body);
    area.current?.focus();
  }, [editing, replyTo]);

  // Höhe automatisch anpassen (max. 6 Zeilen)
  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  if (!token) return null;

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    if (body.length > 4000) return setMsg("Höchstens 4000 Zeichen.");
    if (editing) {
      patchMessage(editing, (m) => ({ ...m, body, editedAt: Date.now() }));
      void chat.edit(token, editing.id, body).catch(() => setMsg("Bearbeiten fehlgeschlagen."));
    } else sendText(token, convId, me, body, replyTo);
    setText("");
    setMsg(null);
    onDone();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sendet (auf Geräten mit Tastatur), Umschalt+Enter = neue Zeile
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape") onDone();
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const img = await prepareImage(file);
      sendMedia(token, convId, me, img.blob, { kind: "image", caption: text.trim() || undefined, width: img.width, height: img.height });
      setText("");
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Bild konnte nicht gesendet werden.");
    }
  };

  const record = async () => {
    setMsg(null);
    try {
      cancelRec.current = false;
      const r = await startRecording(MAX_VOICE_MS, setRecMs, 24_000);
      setRec(r);
      const result = await r.done;
      if (!cancelRec.current) sendMedia(token, convId, me, result.blob, { kind: "voice", durationMs: result.durationMs });
      else URL.revokeObjectURL(result.url);
    } catch (e) {
      setMsg(e instanceof DOMException && e.name === "NotAllowedError" ? "Mikrofon nicht erlaubt." : "Aufnahme nicht möglich.");
    } finally {
      setRec(null);
      setRecMs(0);
    }
  };

  if (rec) {
    const s = Math.floor(recMs / 1000);
    return (
      <div className="composer-bar recording-bar">
        <span className="rec-dot" aria-hidden /> <span>{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`}</span>
        <span className="muted small">max. 2:00</span>
        <span className="spacer" />
        <button type="button" className="small-btn" onClick={() => ((cancelRec.current = true), rec.stop())}>Abbrechen</button>
        <button type="button" className="small-btn primary" onClick={() => rec.stop()}>Senden</button>
      </div>
    );
  }

  return (
    <div className="composer-wrap">
      {(replyTo || editing) && (
        <div className="composer-context">
          <span className="small">
            {editing ? "Bearbeiten" : `Antwort an ${names.get(replyTo!.authorId ?? "") ?? "?"}`}: <span className="muted">{(editing ?? replyTo)!.body.slice(0, 80) || "Medium"}</span>
          </span>
          <button type="button" className="link small" onClick={() => (setText(""), onDone())} aria-label="Abbrechen"><IconClose size={16} /></button>
        </div>
      )}
      {msg && <div className="error small">{msg}</div>}
      {emoji && (
        <EmojiPicker
          onPick={(e) => {
            const el = area.current;
            const pos = el?.selectionStart ?? text.length;
            setText((t) => t.slice(0, pos) + e + t.slice(pos));
            requestAnimationFrame(() => el?.setSelectionRange(pos + e.length, pos + e.length));
          }}
          onClose={() => setEmoji(false)}
        />
      )}
      <div className="composer-bar">
        <button type="button" className="icon-btn" onClick={() => setEmoji((v) => !v)} aria-label="Emoji" aria-expanded={emoji}><IconEmoji size={20} /></button>
        {!editing && (
          <label className="icon-btn" aria-label="Bild senden" title="Bild senden">
            <IconAttach size={19} />
            <input type="file" accept="image/*" hidden onChange={(e) => (void pickImage(e.target.files?.[0]), (e.target.value = ""))} />
          </label>
        )}
        <textarea
          ref={area}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder="Nachricht"
          aria-label="Nachricht schreiben"
          maxLength={4000}
        />
        {text.trim() || editing ? (
          <button type="button" className="icon-btn send" onClick={submit} aria-label={editing ? "Speichern" : "Senden"}>{editing ? <IconCheck size={20} /> : <IconSend size={19} />}</button>
        ) : canRecord() ? (
          <button type="button" className="icon-btn" onClick={() => void record()} aria-label="Sprachnachricht aufnehmen"><IconMic size={19} /></button>
        ) : null}
      </div>
    </div>
  );
}

// ---- Korrigieren & Wörter lernen ----------------------------------------------

function CorrectDialog({ m, onClose }: { m: LocalMessage; onClose: () => void }) {
  const { token } = useSession();
  const [text, setText] = useState(m.correction?.body ?? m.body);
  const save = async () => {
    if (!token) return;
    await chat.correct(token, m.id, text.trim() === m.body.trim() ? "" : text).catch(() => undefined);
    onClose();
  };
  return (
    <div className="sheet" role="dialog" aria-label="Nachricht korrigieren">
      <div className="card stack">
        <b>Korrektur vorschlagen</b>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} aria-label="Korrigierter Text" />
        <div className="small">
          Vorschau: <span className="diff-preview">{text !== m.body ? <DiffPreview before={m.body} after={text} /> : <span className="muted">keine Änderung</span>}</span>
        </div>
        <div className="row">
          <button className="primary" onClick={() => void save()}>Senden</button>
          {m.correction && <button onClick={() => (setText(m.body), void chat.correct(token!, m.id, "").then(onClose))}>Korrektur entfernen</button>}
          <button className="link" onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}


function LearnDialog({ text, onClose }: { text: string; onClose: () => void }) {
  const { collections, user } = useSession();
  const [lang, setLang, learningLangs] = useActiveLang();
  const cards = (useLiveQuery(() => collections.cards).data ?? []) as CardRow[];
  const [result, setResult] = useState<{ matches: LexemeSummary[]; unknown: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setResult(null);
    extract(lang, text, user.nativeLang)
      .then(setResult)
      .catch(() => setError("Auswertung braucht eine Verbindung."));
  }, [lang, text, user.nativeLang]);
  return (
    <div className="sheet" role="dialog" aria-label="Wörter aus Nachricht lernen">
      <div className="card stack">
        <div className="row">
          <b>Wörter lernen</b>
          <span className="spacer" />
          <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)} aria-label="Sprache der Nachricht">
            {learningLangs.map((l) => (
              <option key={l} value={l}>{LANGUAGES[l as LangCode].name}</option>
            ))}
          </select>
        </div>
        {error && <div className="muted small">{error}</div>}
        {!result && !error && <div className="muted small">Werte aus …</div>}
        <ul className="list compact">
          {result?.matches.map((m) => {
            const has = hasCardWord(cards, lang, m.lemma, m.id);
            return (
              <li key={m.id} className="row">
                <WordView lexemeId={m.id} lemma={m.lemma} lang={lang} pronunciation={m.romanization} gloss={m.gloss} cefr={m.cefr} />
                <span className="spacer" />
                {has ? <span className="muted small icon-line"><IconCheck size={14} /> in deiner Sammlung</span> : <button className="small-btn" onClick={() => addCardFromLexeme(collections, m, lang, "chat")}>+ Lernen</button>}
              </li>
            );
          })}
          {result?.unknown.filter((w) => !hasCardWord(cards, lang, w)).slice(0, 20).map((w) => (
            <li key={w} className="row">
              <span>{w}</span> <span className="muted small">nicht im Wörterbuch</span>
              <span className="spacer" />
              <button className="small-btn" onClick={() => addOwnWord(collections, { lang, lemma: w, origin: "chat" })}>+ Eigenes Wort</button>
            </li>
          ))}
        </ul>
        <button onClick={onClose}>Fertig</button>
      </div>
    </div>
  );
}
