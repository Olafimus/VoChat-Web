import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { LANGUAGES, type LangCode, type LexemeSummary } from "@vochat/shared";
import { api, ApiError } from "../api/client";
import { useSession, useSyncStatus } from "../session";
import { useActiveLang } from "../lib/lang";
import { addCardFromLexeme, hasCardFor } from "../lib/cards";
import { newId } from "../lib/ids";
import { LexemeInfo } from "../components/LexemeInfo";
import { CefrBadge, Lemma } from "../components/ui";
import type { MessageRow, CardRow } from "../local/collections";

interface LookupPayload {
  query: string;
  results: LexemeSummary[];
}

/** Chat: Du schreibst ein Wort oder eine Wendung, der Assistent antwortet mit Wörterbuch-Treffern. */
export function ChatPage() {
  const { token, collections, user } = useSession();
  const status = useSyncStatus();
  const [lang, setLang, learning] = useActiveLang();
  const messages = useLiveQuery((q) => collections.messages)
    .data as MessageRow[] | undefined;
  const cards = useLiveQuery((q) => collections.cards).data as CardRow[] | undefined;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const sorted = [...(messages ?? [])].filter((m) => !m.deleted).sort((a, b) => a.createdAt - b.createdAt);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [sorted.length]);

  const post = (row: { role: MessageRow["role"]; kind: MessageRow["kind"]; body: string; payload: unknown }) => {
    const now = Date.now();
    void collections.messages.insert({
      id: newId(),
      updatedAt: now,
      deleted: false,
      createdAt: now,
      ...row,
    });
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const query = text.trim();
    if (!query || busy) return;
    setText("");
    post({ role: "user", kind: "text", body: query, payload: null });

    if (!status.online) {
      post({ role: "assistant", kind: "system", body: "Du bist offline. Nachschlagen braucht eine Verbindung – deine Wortliste funktioniert trotzdem.", payload: null });
      return;
    }
    setBusy(true);
    try {
      const results = await api.search(token, lang, query);
      const payload: LookupPayload = { query, results: results.slice(0, 8) };
      post({
        role: "assistant",
        kind: "lookup",
        body: results.length ? `Treffer für „${query}“ (${LangBadgeText(lang)})` : `Kein Eintrag für „${query}“ in ${LangBadgeText(lang)} gefunden.`,
        payload,
      });
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 0 ? "Keine Verbindung – versuch es gleich nochmal." : "Die Suche ist fehlgeschlagen.";
      post({ role: "assistant", kind: "system", body: msg, payload: null });
    } finally {
      setBusy(false);
    }
  };

  const addToLearning = (lexeme: LexemeSummary) => {
    addCardFromLexeme(collections, lexeme, lang);
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
        <label className="inline">
          Lernsprache
          <select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)}>
            {learning.map((l) => (
              <option key={l} value={l}>{LangBadgeText(l)}</option>
            ))}
          </select>
        </label>
        <span className="muted small">Muttersprache: {user.nativeLang.toUpperCase()}</span>
      </div>

      <div className="messages" aria-live="polite">
        {sorted.length === 0 && (
          <div className="bubble assistant">
            Hallo {user.name}! Schreib ein Wort oder eine Wendung auf {LangBadgeText(lang)} – ich zeige dir Bedeutungen, Beispiele und das Niveau.
          </div>
        )}
        {sorted.map((m) => (
          <div key={m.id} className={`bubble ${m.role} kind-${m.kind}`}>
            {m.kind === "lookup" ? (
              <LookupMessage
                body={m.body}
                payload={m.payload as LookupPayload}
                lang={lang}
                isAdded={(id) => hasCardFor(cards ?? [], id)}
                onAdd={addToLearning}
              />
            ) : (
              <span>{m.body}</span>
            )}
          </div>
        ))}
        {busy && <div className="bubble assistant muted">…</div>}
        <div ref={bottom} />
      </div>

      <form className="composer" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Wort auf ${LangBadgeText(lang)} …`}
          aria-label="Nachricht"
          dir={lang === "fa" ? "rtl" : "ltr"}
        />
        <button className="primary" disabled={!text.trim() || busy}>Senden</button>
      </form>
    </div>
  );
}

function LangBadgeText(lang: string) {
  return LANGUAGES[lang as LangCode]?.name ?? lang;
}

function LookupMessage({
  body,
  payload,
  lang,
  isAdded,
  onAdd,
}: {
  body: string;
  payload: LookupPayload;
  lang: LangCode;
  isAdded: (id: number) => boolean;
  onAdd: (lexeme: LexemeSummary) => void;
}) {
  const [open, setOpen] = useState<number | null>(payload.results.length === 1 ? payload.results[0].id : null);
  return (
    <div>
      <div className="small muted">{body}</div>
      {payload.results.map((r) => (
        <div key={r.id} className="lookup-item">
          <div className="row">
            <button className="link" onClick={() => setOpen(open === r.id ? null : r.id)} aria-expanded={open === r.id}>
              <Lemma lang={lang}>{r.lemma}</Lemma>
            </button>
            {r.pos && <span className="muted small">{r.pos}{r.gender ? ` · ${r.gender}` : ""}</span>}
            <CefrBadge level={r.cefr} />
            {r.gloss && <span className="gloss">{r.gloss}</span>}
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

