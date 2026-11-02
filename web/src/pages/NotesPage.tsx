import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "@tanstack/react-db";
import { LANGUAGES, LANG_CODES, lemmaKey, type LangCode, type NoteLinkType } from "@vochat/shared";
import { useSession } from "../session";
import type { CardRow, MediaCollectionRow, NoteRow } from "../local/collections";
import { useConversations } from "../lib/useChats";
import { newId } from "../lib/ids";
import { PageHeader } from "../components/PageHeader";
import { Empty } from "../components/ui";
import { IconClose, IconLink, IconNotes, IconPin, IconPlus, IconSearch, IconTrash } from "../components/icons";

type NoteLink = NoteRow["links"][number];

const TYPE_LABEL: Record<NoteLinkType, string> = { card: "Wort", collection: "Sammlung", chat: "Chat", note: "Notiz" };

/** Ziel eines Querverweises in der App. */
export const linkTarget = (l: NoteLink): string =>
  l.type === "card" ? `/vocab?card=${encodeURIComponent(l.id)}`
  : l.type === "collection" ? `/paths?open=${encodeURIComponent(l.id)}`
  : l.type === "chat" ? `/chat/${encodeURIComponent(l.id)}`
  : `/notes/${encodeURIComponent(l.id)}`;

const preview = (body: string) => body.replace(/\s+/g, " ").trim().slice(0, 140);
const when = (t: number) => new Date(t).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });

/** Allgemeine Notizen: Liste mit Suche; `/notes/:id` bearbeitet eine Notiz, `/notes/new` legt eine an. */
export function NotesPage() {
  const { id } = useParams();
  return id ? <NoteEditor key={id} id={id} /> : <NoteList />;
}

function useNotes(): NoteRow[] {
  const { collections } = useSession();
  return ((useLiveQuery(() => collections.notes).data ?? []) as NoteRow[]).filter((n) => !n.deleted);
}

function NoteList() {
  const notes = useNotes();
  const [q, setQ] = useState("");
  const [lang, setLang] = useState<LangCode | "all">("all");
  const visible = useMemo(() => {
    const key = lemmaKey(q);
    return notes
      .filter((n) => lang === "all" || n.lang === lang)
      .filter((n) => !key || lemmaKey(n.title).includes(key) || lemmaKey(n.body).includes(key) || n.links.some((l) => lemmaKey(l.label).includes(key)))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt);
  }, [notes, q, lang]);

  return (
    <div className="stack">
      <PageHeader
        icon={<IconNotes size={22} />}
        tone="qt-coral"
        title="Notizen"
        subtitle="Eigene Gedanken zu Wörtern, Lernpfaden und Chats – mit Querverweisen"
        actions={<Link to="/notes/new" className="button primary small-btn"><IconPlus size={16} aria-hidden /> Neu</Link>}
      />
      <div className="toolbar">
        <input type="search" placeholder="Notizen durchsuchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Notizen durchsuchen" />
        <select value={lang} onChange={(e) => setLang(e.target.value as LangCode | "all")} aria-label="Sprache">
          <option value="all">Alle Sprachen</option>
          {LANG_CODES.map((l) => <option key={l} value={l}>{LANGUAGES[l].name}</option>)}
        </select>
      </div>
      {visible.length === 0 && <Empty>{notes.length ? "Keine Notiz gefunden." : "Noch keine Notizen. Halte Grammatik, Eselsbrücken oder Gesprächsideen fest und verlinke sie mit Wörtern und Chats."}</Empty>}
      <ul className="list">
        {visible.map((n) => (
          <li key={n.id} className="card row-card">
            <Link to={`/notes/${n.id}`} className="note-item">
              <div className="row">
                {n.pinned && <IconPin size={15} aria-label="angeheftet" />}
                <b>{n.title || "Ohne Titel"}</b>
                {n.lang && <span className="badge">{LANGUAGES[n.lang as LangCode]?.name ?? n.lang}</span>}
                <span className="spacer" />
                <span className="muted small">{when(n.updatedAt)}</span>
              </div>
              {n.body && <div className="muted small">{preview(n.body)}</div>}
              {n.links.length > 0 && (
                <div className="chips">
                  {n.links.slice(0, 6).map((l) => <span key={`${l.type}:${l.id}`} className="badge subtle">{TYPE_LABEL[l.type]}: {l.label}</span>)}
                  {n.links.length > 6 && <span className="muted small">+{n.links.length - 6}</span>}
                </div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoteEditor({ id }: { id: string }) {
  const { collections, token } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const notes = useNotes();
  const cards = (useLiveQuery(() => collections.cards).data ?? []) as CardRow[];
  const existing = id === "new" ? undefined : notes.find((n) => n.id === id);
  const isNew = id === "new";

  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [lang, setLang] = useState<LangCode | "">((existing?.lang as LangCode | null) ?? "");
  const [pinned, setPinned] = useState(existing?.pinned ?? false);
  const [links, setLinks] = useState<NoteLink[]>(existing?.links ?? []);

  // Neue Notiz kann mit einem Verweis starten (?card=<id>, ?chat=<id>&label=…, ?collection=<id>).
  // Karten laden evtl. erst nach dem ersten Render, daher als Effekt; jeder Verweis wird nur einmal vorbelegt.
  const seeded = useRef(new Set<string>());
  useEffect(() => {
    if (!isNew) return;
    const add = (key: string, link: NoteLink) => {
      if (seeded.current.has(key)) return;
      seeded.current.add(key);
      setLinks((prev) => (prev.some((x) => x.type === link.type && x.id === link.id) ? prev : [...prev, link]));
    };
    const card = params.get("card");
    const found = card ? cards.find((c) => c.id === card && !c.deleted) : undefined;
    if (found) add("card", { type: "card", id: found.id, label: found.lemma });
    const chat = params.get("chat");
    if (chat) add("chat", { type: "chat", id: chat, label: params.get("label") ?? "Chat" });
    const coll = params.get("collection");
    if (coll) add("collection", { type: "collection", id: coll, label: params.get("label") ?? "Sammlung" });
  }, [isNew, params, cards]);
  const [picking, setPicking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!isNew && !existing) {
    return (
      <div className="stack">
        <PageHeader icon={<IconNotes size={22} />} tone="qt-coral" title="Notiz" />
        <Empty>Diese Notiz gibt es nicht (mehr).</Empty>
        <Link to="/notes">Zu allen Notizen</Link>
      </div>
    );
  }

  const backlinks = notes.filter((n) => n.id !== id && n.links.some((l) => l.type === "note" && l.id === id));

  const save = (e: FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const data = { title: title.trim(), body, lang: lang || null, links, pinned };
    if (existing) {
      collections.notes.update(existing.id, (d) => {
        Object.assign(d, data, { updatedAt: now });
      });
      setMsg("Gespeichert.");
    } else {
      if (!data.title && !data.body.trim()) return setMsg("Titel oder Text fehlt.");
      const row: NoteRow = { id: newId(), ...data, createdAt: now, updatedAt: now, deleted: false };
      void collections.notes.insert(row);
      navigate(`/notes/${row.id}`, { replace: true });
    }
  };

  const remove = () => {
    if (!existing || !window.confirm("Diese Notiz löschen?")) return;
    collections.notes.update(existing.id, (d) => {
      d.deleted = true;
      d.updatedAt = Date.now();
    });
    navigate("/notes");
  };

  const addLink = (l: NoteLink) => {
    setLinks((prev) => (prev.some((x) => x.type === l.type && x.id === l.id) ? prev : [...prev, l]));
    setPicking(false);
  };

  return (
    <form className="stack" onSubmit={save}>
      <PageHeader
        icon={<IconNotes size={22} />}
        tone="qt-coral"
        title={isNew ? "Neue Notiz" : "Notiz"}
        actions={<Link to="/notes" className="button small-btn">Alle Notizen</Link>}
      />
      <div className="card stack">
        <label>
          Titel
          <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Höflichkeitsformen" />
        </label>
        <label>
          Text
          <textarea className="note note-body" value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} placeholder="Grammatik, Eselsbrücken, Gesprächsideen …" />
        </label>
        <div className="row">
          <label style={{ flex: 1 }}>
            Sprache (optional)
            <select value={lang} onChange={(e) => setLang(e.target.value as LangCode | "")}>
              <option value="">–</option>
              {LANG_CODES.map((l) => <option key={l} value={l}>{LANGUAGES[l].name}</option>)}
            </select>
          </label>
          <button type="button" className={`small-btn ${pinned ? "on" : ""}`} aria-pressed={pinned} onClick={() => setPinned(!pinned)}>
            <IconPin size={15} aria-hidden /> {pinned ? "Angeheftet" : "Anheften"}
          </button>
        </div>
      </div>

      <div className="card stack">
        <div className="row">
          <h2 style={{ margin: 0 }}>Querverweise</h2>
          <span className="spacer" />
          <button type="button" className="small-btn" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
            <IconLink size={15} aria-hidden /> Verweis hinzufügen
          </button>
        </div>
        {picking && <LinkPicker token={token} selfId={id} cards={cards} notes={notes} onPick={addLink} />}
        {links.length === 0 && !picking && <div className="muted small">Verknüpfe die Notiz mit Wörtern, Sammlungen, Chats oder anderen Notizen.</div>}
        <ul className="list compact">
          {links.map((l) => (
            <li key={`${l.type}:${l.id}`} className="row">
              <span className="badge subtle">{TYPE_LABEL[l.type]}</span>
              <Link to={linkTarget(l)}>{l.label || l.id}</Link>
              <span className="spacer" />
              <button type="button" className="small-btn" aria-label={`Verweis ${l.label} entfernen`} onClick={() => setLinks(links.filter((x) => !(x.type === l.type && x.id === l.id)))}>
                <IconClose size={14} />
              </button>
            </li>
          ))}
        </ul>
        {backlinks.length > 0 && (
          <div className="stack">
            <div className="muted small">Verlinkt von</div>
            <div className="chips">
              {backlinks.map((n) => <Link key={n.id} to={`/notes/${n.id}`} className="badge">{n.title || "Ohne Titel"}</Link>)}
            </div>
          </div>
        )}
      </div>

      {msg && <div className="muted small" role="status">{msg}</div>}
      <div className="row">
        <button className="primary">Speichern</button>
        {existing && <button type="button" className="danger" onClick={remove}><IconTrash size={16} aria-hidden /> Löschen</button>}
      </div>
    </form>
  );
}

/** Suche nach Verweisen: eigene Wörter, Sammlungen/Lernpfade, Chats und andere Notizen. */
function LinkPicker({ token, selfId, cards, notes, onPick }: { token: string | null; selfId: string; cards: CardRow[]; notes: NoteRow[]; onPick: (l: NoteLink) => void }) {
  const { collections } = useSession();
  const own = (useLiveQuery(() => collections.collections).data ?? []) as MediaCollectionRow[];
  const { list: chats } = useConversations(token);
  const [type, setType] = useState<NoteLinkType>("card");
  const [q, setQ] = useState("");

  const key = lemmaKey(q);
  const options: NoteLink[] = useMemo(() => {
    const all: NoteLink[] =
      type === "card" ? cards.filter((c) => !c.deleted).map((c) => ({ type, id: c.id, label: c.gloss ? `${c.lemma} – ${c.gloss}` : c.lemma }))
      : type === "collection" ? own.filter((c) => !c.deleted).map((c) => ({ type, id: c.id, label: c.title }))
      : type === "chat" ? (chats ?? []).map((c) => ({ type, id: c.id, label: c.title }))
      : notes.filter((n) => n.id !== selfId).map((n) => ({ type, id: n.id, label: n.title || "Ohne Titel" }));
    return all.filter((o) => !key || lemmaKey(o.label).includes(key)).slice(0, 8);
  }, [type, key, cards, own, chats, notes, selfId]);

  return (
    <div className="stack link-picker">
      <div className="chips" role="tablist">
        {(Object.keys(TYPE_LABEL) as NoteLinkType[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={type === t} className={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>
      <label className="admin-search">
        <IconSearch size={18} aria-hidden />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${TYPE_LABEL[type]} suchen …`} aria-label="Verweisziel suchen" />
      </label>
      {type === "chat" && !token && <div className="muted small">Chats gibt es nur mit Konto.</div>}
      <ul className="list compact">
        {options.map((o) => (
          <li key={o.id}>
            <button type="button" className="small-btn wide-left" onClick={() => onPick(o)}>{o.label}</button>
          </li>
        ))}
        {options.length === 0 && !(type === "chat" && !token) && <li className="muted small">Nichts gefunden.</li>}
      </ul>
    </div>
  );
}
