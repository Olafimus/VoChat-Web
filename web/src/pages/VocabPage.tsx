import { useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { LANGUAGES, lemmaKey, type LangCode } from "@vochat/shared";
import { ApiError, community } from "../api/client";
import { useSession, useSyncStatus } from "../session";
import type { CardRow, MediaCollectionRow } from "../local/collections";
import { addOwnWord, editCard, resetField, type EditableField } from "../lib/cards";
import { useActiveLang } from "../lib/lang";
import { linkWithDictionary } from "../lib/linker";
import { Empty } from "../components/ui";
import { WordView } from "../components/WordView";

const STATUS_LABEL: Record<CardRow["status"], string> = {
  new: "neu",
  learning: "lernend",
  review: "wiederholen",
  mastered: "gemeistert",
};

const FIELD_LABEL: Record<EditableField, string> = {
  lemma: "Wort",
  gloss: "Bedeutung",
  pronunciation: "Aussprache",
  cefr: "Niveau",
};

/** Wortliste: Suche, Filter, Bearbeiten mit Bezug zum Wörterbuch, Vorschläge fürs Wörterbuch. */
export function VocabPage() {
  const { collections, user } = useSession();
  const status = useSyncStatus();
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];
  const own = (useLiveQuery((q) => collections.collections).data ?? []) as MediaCollectionRow[];
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<LangCode | "all">("all");
  const [status_, setStatus] = useState<CardRow["status"] | "all">("all");
  const [link, setLink] = useState<"all" | "linked" | "unlinked">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const visible = useMemo(() => {
    const q = lemmaKey(query);
    return cards
      .filter((c) => !c.deleted)
      .filter((c) => lang === "all" || c.lang === lang)
      .filter((c) => status_ === "all" || c.status === status_)
      .filter((c) => link === "all" || (link === "linked" ? !!c.lexemeId : !c.lexemeId))
      .filter((c) => !q || lemmaKey(c.lemma).includes(q) || lemmaKey(c.gloss ?? "").includes(q))
      .sort((a, b) => a.lemma.localeCompare(b.lemma));
  }, [cards, query, lang, status_, link]);

  const unlinkedCount = cards.filter((c) => !c.deleted && !c.lexemeId).length;

  const linkNow = async () => {
    setSyncMsg("Gleiche mit dem Wörterbuch ab …");
    try {
      const r = await linkWithDictionary(collections, cards, own, user.nativeLang, { force: true });
      setSyncMsg(`${r.linked} neu verknüpft · ${r.refreshed} aktualisiert${r.items ? ` · ${r.items} Sammlungswörter verknüpft` : ""}`);
    } catch {
      setSyncMsg("Abgleich nicht möglich (offline?).");
    }
  };

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
        <select value={status_} onChange={(e) => setStatus(e.target.value as CardRow["status"] | "all")} aria-label="Status">
          <option value="all">Alle Status</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="row">
        <div className="chips">
          <button className={`chip ${link === "all" ? "on" : ""}`} onClick={() => setLink("all")}>Alle</button>
          <button className={`chip ${link === "linked" ? "on" : ""}`} onClick={() => setLink("linked")}>Im Wörterbuch</button>
          <button className={`chip ${link === "unlinked" ? "on" : ""}`} onClick={() => setLink("unlinked")}>
            Nur eigene{unlinkedCount ? ` (${unlinkedCount})` : ""}
          </button>
        </div>
        <span className="spacer" />
        <button className="small-btn" onClick={() => setAdding((v) => !v)} aria-expanded={adding}>+ Eigenes Wort</button>
        <button className="small-btn" onClick={linkNow} disabled={!status.online}>Mit Wörterbuch abgleichen</button>
      </div>
      {adding && <OwnWordForm onDone={() => setAdding(false)} />}
      {syncMsg && <div className="muted small" role="status">{syncMsg}</div>}
      <div className="muted small">{visible.length} Vokabeln</div>
      {visible.length === 0 && <Empty>Noch nichts hier. Schreib im Chat ein Wort und tippe „+ Lernen“.</Empty>}
      <ul className="list">
        {visible.map((c) => (
          <li key={c.id} className="card row-card">
            <div className="row">
              <WordView lemma={c.lemma} lang={c.lang as LangCode} pronunciation={c.pronunciation} gloss={c.gloss} cefr={c.cefr} />
              <span className="badge subtle">{STATUS_LABEL[c.status]}</span>
              <span className={`badge ${c.lexemeId ? "linked" : "subtle"}`} title={c.lexemeId ? "Mit dem Wörterbuch verknüpft" : "Nur in deinem Wortschatz"}>
                {c.lexemeId ? "🔗 Wörterbuch" : "eigenes Wort"}
              </span>
              <span className="spacer" />
              <button className="small-btn" onClick={() => setEditing(editing === c.id ? null : c.id)} aria-expanded={editing === c.id}>
                {editing === c.id ? "Schließen" : "Bearbeiten"}
              </button>
              <button
                className="small-btn danger"
                onClick={() =>
                  collections.cards.update(c.id, (d) => {
                    d.deleted = true;
                    d.updatedAt = Date.now();
                  })
                }
                aria-label={`${c.lemma} entfernen`}
              >
                Entfernen
              </button>
            </div>
            {editing !== c.id && c.note && <div className="muted small">{c.note}</div>}
            {editing === c.id && <CardEditor card={c} onDone={() => setEditing(null)} />}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CardEditor({ card, onDone }: { card: CardRow; onDone: () => void }) {
  const { collections, token, user } = useSession();
  const status = useSyncStatus();
  const [form, setForm] = useState({
    lemma: card.lemma,
    gloss: card.gloss ?? "",
    pronunciation: card.pronunciation ?? "",
    note: card.note,
  });
  const [msg, setMsg] = useState<string | null>(null);
  const custom = new Set(card.custom ?? []);

  const save = () => {
    editCard(collections, card, {
      lemma: form.lemma.trim() || card.lemma,
      gloss: form.gloss.trim() || null,
      pronunciation: form.pronunciation.trim() || null,
      note: form.note,
    });
    onDone();
  };

  const suggest = async (payload: Record<string, unknown>, label: string) => {
    if (!token) return setMsg("Für Vorschläge bitte unter Profil ein Konto anlegen.");
    try {
      await community.submit(token, payload);
      setMsg(`${label} vorgeschlagen. Nach der Prüfung erscheint es im Wörterbuch und verknüpft sich automatisch.`);
    } catch (err) {
      setMsg(err instanceof ApiError && err.status === 0 ? "Offline – Vorschlag nicht gesendet." : "Vorschlag fehlgeschlagen.");
    }
  };

  const field = (key: "lemma" | "gloss" | "pronunciation", label: string) => {
    const inputId = `edit-${card.id}-${key}`;
    return (
      <div className="field">
        <div className="row field-head">
          <label htmlFor={inputId}>{label}</label>
          {custom.has(key) && card.lexemeId && (
            <>
              <span className="badge subtle">eigener Wert</span>
              <button
                type="button"
                className="link small"
                onClick={() => {
                  resetField(collections, card, key);
                  setMsg(`${FIELD_LABEL[key]} folgt wieder dem Wörterbuch (beim nächsten Abgleich).`);
                }}
              >
                ↺ Wörterbuchwert
              </button>
            </>
          )}
        </div>
        <input
          id={inputId}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          dir={key === "lemma" && card.lang === "fa" ? "rtl" : "ltr"}
        />
      </div>
    );
  };

  return (
    <div className="stack card-editor">
      {field("lemma", "Wort")}
      {field("gloss", "Bedeutung")}
      {field("pronunciation", "Aussprache")}
      <label>
        Notiz
        <textarea className="note" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Eselsbrücke, Kontext, Beispiel …" />
      </label>
      <div className="row">
        <button className="primary small-btn" onClick={save}>Speichern</button>
        <button className="small-btn" onClick={onDone}>Abbrechen</button>
      </div>
      <div className="muted small">
        {card.lexemeId
          ? "Verknüpft mit dem Wörterbuch. Deine Änderungen gelten nur für dich; nicht geänderte Felder übernehmen neue Wörterbuchwerte."
          : "Dieses Wort fehlt im Wörterbuch. Sobald es dort auftaucht, wird es automatisch verknüpft."}
      </div>
      <div className="row">
        {!card.lexemeId && (
          <button
            className="small-btn"
            disabled={!status.online || !card.gloss}
            title={!card.gloss ? "Zuerst eine Bedeutung eintragen" : undefined}
            onClick={() =>
              suggest(
                { kind: "lexeme", lang: card.lang, lemma: card.lemma, pos: "", glossLang: user.nativeLang, gloss: card.gloss, romanization: card.pronunciation },
                "Wort",
              )
            }
          >
            Ins Wörterbuch vorschlagen
          </button>
        )}
        {card.lexemeId && custom.has("gloss") && card.gloss && (
          <button className="small-btn" disabled={!status.online} onClick={() => suggest({ kind: "sense", lexemeId: card.lexemeId, glossLang: user.nativeLang, gloss: card.gloss }, "Bedeutung")}>
            Bedeutung fürs Wörterbuch vorschlagen
          </button>
        )}
        {card.lexemeId && custom.has("pronunciation") && card.pronunciation && (
          <button className="small-btn" disabled={!status.online} onClick={() => suggest({ kind: "pronunciation", lexemeId: card.lexemeId, romanization: card.pronunciation }, "Aussprache")}>
            Aussprache vorschlagen
          </button>
        )}
      </div>
      {msg && <div className="muted small" role="status">{msg}</div>}
    </div>
  );
}

/** Eigenes Wort anlegen – auch wenn es (noch) nicht im Wörterbuch steht. */
function OwnWordForm({ onDone }: { onDone: () => void }) {
  const { collections } = useSession();
  const [activeLang, , learning] = useActiveLang();
  const [lang, setLang] = useState<LangCode>(activeLang);
  const [form, setForm] = useState({ lemma: "", gloss: "", pronunciation: "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lemma.trim()) return;
    addOwnWord(collections, { lang, ...form });
    onDone();
  };
  return (
    <form className="card stack" onSubmit={submit}>
      <div className="row">
        <label style={{ flex: 1 }}>
          Sprache
          <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)}>
            {(learning.length ? learning : (Object.keys(LANGUAGES) as LangCode[])).map((l) => (
              <option key={l} value={l}>{LANGUAGES[l].name}</option>
            ))}
          </select>
        </label>
        <label style={{ flex: 2 }}>
          Wort
          <input required value={form.lemma} onChange={(e) => setForm({ ...form, lemma: e.target.value })} dir={lang === "fa" ? "rtl" : "ltr"} />
        </label>
      </div>
      <div className="row">
        <label style={{ flex: 2 }}>
          Bedeutung
          <input value={form.gloss} onChange={(e) => setForm({ ...form, gloss: e.target.value })} />
        </label>
        <label style={{ flex: 1 }}>
          Aussprache
          <input value={form.pronunciation} onChange={(e) => setForm({ ...form, pronunciation: e.target.value })} />
        </label>
      </div>
      <div className="muted small">Steht das Wort im Wörterbuch, wird es automatisch verknüpft. Deine Angaben bleiben dabei erhalten.</div>
      <div className="row">
        <button className="primary small-btn">Hinzufügen</button>
        <button type="button" className="small-btn" onClick={onDone}>Abbrechen</button>
      </div>
    </form>
  );
}
