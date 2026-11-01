import { useEffect, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { CEFR_LEVELS, type Cefr, type LangCode, type LexemeSummary } from "@vochat/shared";
import { api, ApiError } from "../api/client";
import { useSession, useSyncStatus } from "../session";
import { useActiveLang } from "../lib/lang";
import { addCardFromLexeme, hasCardFor } from "../lib/cards";
import { CefrBadge, Empty, Lemma } from "../components/ui";
import type { CardRow } from "../local/collections";

const PAGE = 50;

/** Entdecken: Wörterbuch nach Niveau (A1–C2) und Häufigkeit durchstöbern, Wörter übernehmen. */
export function BrowsePage() {
  const { token, collections } = useSession();
  const status = useSyncStatus();
  const [lang, setLang, learning] = useActiveLang();
  const [cefr, setCefr] = useState<Cefr | null>("A1");
  const [items, setItems] = useState<LexemeSummary[]>([]);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];

  useEffect(() => {
    setItems([]);
    setOffset(0);
    load(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, cefr, token]);

  const load = (from: number, replace: boolean) => {
    api
      .browse(token, lang as LangCode, cefr, from)
      .then((rows) => {
        setItems((prev) => (replace ? rows : [...prev, ...rows]));
        setOffset(from + rows.length);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError && err.status === 0 ? "Offline – Entdecken braucht eine Verbindung." : "Laden fehlgeschlagen."));
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)} aria-label="Sprache">
          {learning.map((l) => (
            <option key={l} value={l}>{l.toUpperCase()}</option>
          ))}
        </select>
        <div className="chips">
          <button className={`chip ${cefr === null ? "on" : ""}`} onClick={() => setCefr(null)}>Alle</button>
          {CEFR_LEVELS.map((level) => (
            <button key={level} className={`chip ${cefr === level ? "on" : ""}`} onClick={() => setCefr(level)}>
              {level}
            </button>
          ))}
        </div>
      </div>
      {!status.online && <div className="warn-box">Offline – du kannst nur bereits geladene Einträge hinzufügen.</div>}
      {error && <div className="error">{error}</div>}
      {items.length === 0 && !error && <Empty>Keine Einträge für dieses Niveau.</Empty>}
      <ul className="list">
        {items.map((it) => (
          <li key={it.id} className="row card-line">
            <Lemma lang={lang}>{it.lemma}</Lemma>
            {it.pos && <span className="muted small">{it.pos}</span>}
            <CefrBadge level={it.cefr} />
            {it.gloss && <span className="gloss">{it.gloss}</span>}
            <span className="spacer" />
            {hasCardFor(cards, it.id) ? (
              <span className="muted small">✓</span>
            ) : (
              <button className="small-btn" onClick={() => addCardFromLexeme(collections, it, lang)}>+ Lernen</button>
            )}
          </li>
        ))}
      </ul>
      {items.length >= PAGE - 1 && (
        <button className="wide" onClick={() => load(offset, false)}>Mehr laden</button>
      )}
    </div>
  );
}
