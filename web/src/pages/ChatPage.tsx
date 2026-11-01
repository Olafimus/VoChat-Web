import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLiveQuery } from "@tanstack/react-db";
import { LANGUAGES, type ExtractResult, type LangCode, type LexemeSummary } from "@vochat/shared";
import { api, ApiError, extract } from "../api/client";
import { useSession, useSyncStatus } from "../session";
import { useActiveLang } from "../lib/lang";
import { addCardFromLexeme, addOwnWord, hasCardFor, hasCardWord } from "../lib/cards";
import { newId } from "../lib/ids";
import { LexemeInfo } from "../components/LexemeInfo";
import { WordView } from "../components/WordView";
import type { MessageRow, CardRow } from "../local/collections";

interface LookupPayload {
  query: string;
  results: LexemeSummary[];
}

/** Chat: Wort oder Wendung nachschlagen, eigene Nachrichten korrigieren, Vokabeln aus Text extrahieren. */
export function ChatPage() {
  const { token, collections, user } = useSession();
  const status = useSyncStatus();
  const [lang, setLang, learning] = useActiveLang();
  const messages = (useLiveQuery((q) => collections.messages).data ?? []) as MessageRow[];
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sorted = messages.filter((m) => !m.deleted).sort((a, b) => a.createdAt - b.createdAt);

  // Virtualisiert: nur sichtbare Nachrichten im DOM – bleibt auch bei tausenden Einträgen flüssig.
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (sorted[i]?.kind === "lookup" ? 220 : 64),
    getItemKey: (i) => sorted[i]?.id ?? i,
    overscan: 6,
  });
  useLayoutEffect(() => {
    if (sorted.length === 0) return;
    virtualizer.scrollToIndex(sorted.length - 1, { align: "end" });
    const t = requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted.length]);

  const post = (row: { role: MessageRow["role"]; kind: MessageRow["kind"]; body: string; payload: unknown }) => {
    const now = Date.now();
    void collections.messages.insert({
      id: newId(),
      updatedAt: now,
      deleted: false,
      createdAt: now,
      editedAt: null,
      ...row,
    });
  };

  const offlineHint = () =>
    post({ role: "assistant", kind: "system", body: "Du bist offline. Nachschlagen braucht eine Verbindung – deine Wortliste funktioniert trotzdem.", payload: null });

  const lookup = async (query: string, targetLang: LangCode) => {
    if (!status.online) return offlineHint();
    setBusy(true);
    try {
      const results = await api.search(targetLang, query, user.nativeLang);
      const payload: LookupPayload = { query, results: results.slice(0, 8) };
      post({
        role: "assistant",
        kind: "lookup",
        body: results.length ? `Treffer für „${query}“ (${LANGUAGES[targetLang].name})` : `Kein Eintrag für „${query}“ in ${LANGUAGES[targetLang].name} gefunden.`,
        payload,
      });
    } catch (err) {
      post({
        role: "assistant",
        kind: "system",
        body: err instanceof ApiError && err.status === 0 ? "Keine Verbindung – versuch es gleich nochmal." : "Die Suche ist fehlgeschlagen.",
        payload: null,
      });
    } finally {
      setBusy(false);
    }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const query = text.trim();
    if (!query || busy) return;
    setText("");
    post({ role: "user", kind: "text", body: query, payload: null });
    await lookup(query, lang);
  };

  /** Korrektur: Text ändern, markieren, bei Suchen erneut nachschlagen. */
  const saveEdit = async () => {
    if (!editing) return;
    const newBody = editing.text.trim();
    const original = sorted.find((m) => m.id === editing.id);
    setEditing(null);
    if (!original || !newBody || newBody === original.body) return;
    const now = Date.now();
    collections.messages.update(original.id, (d) => {
      d.body = newBody;
      d.editedAt = now;
      d.updatedAt = now;
    });
    post({ role: "assistant", kind: "system", body: `Korrigiert: „${newBody}“ – neu nachgeschlagen.`, payload: null });
    await lookup(newBody, lang);
  };

  /** Vokabeln aus einer Nachricht ziehen: Treffer und unbekannte Wörter anzeigen. */
  const extractFrom = async (m: MessageRow) => {
    if (!status.online) return offlineHint();
    setBusy(true);
    try {
      const result: ExtractResult = await extract(lang, m.body, user.nativeLang);
      post({ role: "assistant", kind: "extract", body: `Wörter aus „${m.body.slice(0, 60)}“`, payload: result });
    } catch {
      post({ role: "assistant", kind: "system", body: "Die Wortextraktion ist fehlgeschlagen.", payload: null });
    } finally {
      setBusy(false);
    }
  };

  if (learning.length === 0) {
    return (
      <div className="card">
        <h2>Noch keine Lernsprache</h2>
        <p className="muted">Wähle unter <b>Profil</b> mindestens eine Sprache, die du lernen möchtest.</p>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <Link to="/chat" className="conv-back" aria-label="Zurück zu den Chats">←</Link>
        <b>📖 Assistent</b>
        <span className="spacer" />
        <label className="inline">
          Lernsprache
          <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)}>
            {learning.map((l) => (
              <option key={l} value={l}>{LANGUAGES[l].name}</option>
            ))}
          </select>
        </label>
        <span className="muted small">Muttersprache: {user.nativeLang.toUpperCase()}</span>
      </div>

      <div className="messages" aria-live="polite" ref={scrollRef}>
        {sorted.length === 0 && (
          <div className="bubble assistant">
            Hallo {user.name}! Schreib ein Wort oder eine Wendung auf {LANGUAGES[lang].name} – ich zeige dir Bedeutungen, Beispiele und das Niveau. Ganze Sätze kannst du mit „Wörter extrahieren“ durchsuchen.
          </div>
        )}
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((v) => {
          const m = sorted[v.index];
          return (
          <div key={v.key} data-index={v.index} ref={virtualizer.measureElement} className="vrow" style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${v.start}px)` }}>
          <div className={`bubble ${m.role} kind-${m.kind}`}>
            {m.kind === "lookup" && (
              <LookupMessage
                body={m.body}
                payload={m.payload as LookupPayload}
                lang={lang}
                isAdded={(id) => hasCardFor(cards, id)}
                onAdd={(lexeme) => addCardFromLexeme(collections, lexeme, lang, "chat")}
                ownExists={hasCardWord(cards, lang, (m.payload as LookupPayload).query)}
                onAddOwn={(word) => addOwnWord(collections, { lang, lemma: word, origin: "chat" })}
              />
            )}
            {m.kind === "extract" && (
              <ExtractMessage
                body={m.body}
                payload={m.payload as ExtractResult}
                lang={lang}
                cards={cards}
                onAdd={(lexeme) => addCardFromLexeme(collections, lexeme, lang, "chat")}
              />
            )}
            {(m.kind === "text" || m.kind === "system") && editing?.id !== m.id && <span>{m.body}</span>}
            {m.kind === "text" && m.role === "user" && editing?.id === m.id && (
              <div className="stack" style={{ gap: "0.4rem" }}>
                <input
                  value={editing.text}
                  onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                  aria-label="Nachricht korrigieren"
                  onKeyDown={(e) => e.key === "Enter" && void saveEdit()}
                  dir={lang === "fa" ? "rtl" : "ltr"}
                />
                <div className="row">
                  <button className="small-btn primary" onClick={() => void saveEdit()}>Speichern</button>
                  <button className="small-btn" onClick={() => setEditing(null)}>Abbrechen</button>
                </div>
              </div>
            )}
            {m.role === "user" && m.kind === "text" && editing?.id !== m.id && (
              <div className="msg-actions">
                {m.editedAt && <span className="muted small">bearbeitet · </span>}
                <button className="link small" onClick={() => setEditing({ id: m.id, text: m.body })}>Korrigieren</button>
                <button className="link small" onClick={() => void extractFrom(m)} disabled={busy}>Wörter extrahieren</button>
              </div>
            )}
          </div>
          </div>
          );
        })}
        </div>
        {busy && <div className="bubble assistant muted">…</div>}
      </div>

      <form className="composer" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Wort oder Satz auf ${LANGUAGES[lang].name} …`}
          aria-label="Nachricht"
          dir={lang === "fa" ? "rtl" : "ltr"}
        />
        <button className="primary" disabled={!text.trim() || busy}>Senden</button>
      </form>
    </div>
  );
}

function LookupMessage({
  body,
  payload,
  lang,
  isAdded,
  onAdd,
  ownExists,
  onAddOwn,
}: {
  body: string;
  payload: LookupPayload;
  lang: LangCode;
  isAdded: (id: number) => boolean;
  onAdd: (lexeme: LexemeSummary) => void;
  ownExists: boolean;
  onAddOwn: (word: string) => void;
}) {
  const [open, setOpen] = useState<number | null>(payload.results.length === 1 ? payload.results[0].id : null);
  return (
    <div>
      <div className="small muted">{body}</div>
      {payload.results.length === 0 && (
        <div className="row" style={{ marginTop: "0.4rem" }}>
          {ownExists ? (
            <span className="muted small">✓ als eigenes Wort gespeichert</span>
          ) : (
            <button className="small-btn" onClick={() => onAddOwn(payload.query)}>Als eigenes Wort speichern</button>
          )}
          <span className="muted small">Bedeutung kannst du im Wortschatz ergänzen.</span>
        </div>
      )}
      {payload.results.map((r) => (
        <div key={r.id} className="lookup-item">
          <div className="row">
            <button className="link" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
              <WordView lexemeId={r.id} lemma={r.lemma} lang={lang} pronunciation={r.romanization} gloss={r.gloss} cefr={r.cefr} pos={r.pos} gender={r.gender} />
            </button>
            <span className="spacer" />
            {isAdded(r.id) ? (
              <span className="muted small">✓ in Liste</span>
            ) : (
              <button className="small-btn" onClick={() => onAdd(r)}>+ Lernen</button>
            )}
          </div>
          {open === r.id && <LexemeInfo lexeme={r} lang={lang} />}
        </div>
      ))}
    </div>
  );
}

function ExtractMessage({
  body,
  payload,
  lang,
  cards,
  onAdd,
}: {
  body: string;
  payload: ExtractResult;
  lang: LangCode;
  cards: CardRow[];
  onAdd: (lexeme: LexemeSummary) => void;
}) {
  const fresh = payload.matches.filter((m) => !hasCardFor(cards, m.id) && !hasCardWord(cards, lang, m.lemma, m.id));
  return (
    <div className="stack" style={{ gap: "0.4rem" }}>
      <div className="small muted">{body}</div>
      {payload.matches.length === 0 && <div>Keine bekannten Wörter gefunden.</div>}
      {payload.matches.map((m) => (
        <div key={m.id} className="row">
          <WordView lexemeId={m.id} lemma={m.lemma} lang={lang} pronunciation={m.romanization} gloss={m.gloss} cefr={m.cefr} />
          <span className="spacer" />
          {fresh.some((f) => f.id === m.id) ? (
            <button className="small-btn" onClick={() => onAdd(m)}>+ Lernen</button>
          ) : (
            <span className="muted small">✓</span>
          )}
        </div>
      ))}
      {fresh.length > 1 && (
        <button className="small-btn primary" onClick={() => fresh.forEach(onAdd)}>Alle {fresh.length} neuen lernen</button>
      )}
      {payload.unknown.length > 0 && (
        <div className="muted small">Ohne Eintrag: {payload.unknown.slice(0, 30).join(", ")}{payload.unknown.length > 30 ? " …" : ""}</div>
      )}
    </div>
  );
}
