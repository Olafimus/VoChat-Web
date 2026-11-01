import { useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { LANGUAGES, type LangCode } from "@vochat/shared";
import { useSession } from "../session";
import type { CardRow } from "../local/collections";
import { Empty } from "../components/ui";
import { WordView } from "../components/WordView";

const STATUS_LABEL: Record<CardRow["status"], string> = {
  new: "neu",
  learning: "lernend",
  review: "wiederholen",
  mastered: "gemeistert",
};

/** Wortliste: Suche, Filter nach Sprache und Status, Notizen, Entfernen. */
export function VocabPage() {
  const { collections } = useSession();
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<LangCode | "all">("all");
  const [status, setStatus] = useState<CardRow["status"] | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards
      .filter((c) => !c.deleted)
      .filter((c) => lang === "all" || c.lang === lang)
      .filter((c) => status === "all" || c.status === status)
      .filter((c) => !q || c.lemma.toLowerCase().includes(q) || (c.gloss ?? "").toLowerCase().includes(q))
      .sort((a, b) => a.lemma.localeCompare(b.lemma));
  }, [cards, query, lang, status]);

  const update = (id: string, patch: Partial<CardRow>) =>
    collections.cards.update(id, (draft) => {
      Object.assign(draft, patch, { updatedAt: Date.now() });
    });

  return (
    <div className="stack">
      <div className="toolbar">
        <input type="search" placeholder="Suchen …" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Wortliste durchsuchen" />
        <select value={lang} onChange={(e) => setLang(e.target.value as LangCode | "all")} aria-label="Sprache">
          <option value="all">Alle Sprachen</option>
          {Object.values(LANGUAGES).map((l) => (
            <option key={l.code} value={l.code}>{l.name}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as CardRow["status"] | "all")} aria-label="Status">
          <option value="all">Alle Status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="muted small">{visible.length} Vokabeln</div>
      {visible.length === 0 && <Empty>Noch nichts hier. Schreib im Chat ein Wort und tippe „+ Lernen“.</Empty>}
      <ul className="list">
        {visible.map((c) => (
          <li key={c.id} className="card row-card">
            <div className="row">
              <WordView lemma={c.lemma} lang={c.lang as LangCode} pronunciation={c.pronunciation} gloss={c.gloss} cefr={c.cefr} />
              <span className="badge subtle">{STATUS_LABEL[c.status]}</span>
              <span className="spacer" />
              <button className="small-btn" onClick={() => setEditing(editing === c.id ? null : c.id)}>
                {editing === c.id ? "Fertig" : "Notiz"}
              </button>
              <button
                className="small-btn danger"
                onClick={() => update(c.id, { deleted: true })}
                aria-label={`${c.lemma} entfernen`}
              >
                Entfernen
              </button>
            </div>
            {editing === c.id && (
              <textarea
                className="note"
                defaultValue={c.note}
                placeholder="Eselsbrücke, Kontext, Beispiel …"
                onBlur={(e) => e.target.value !== c.note && update(c.id, { note: e.target.value })}
              />
            )}
            {editing !== c.id && c.note && <div className="muted small">{c.note}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
