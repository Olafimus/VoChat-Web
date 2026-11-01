import { useEffect, useState } from "react";
import { LANG_CODES, LANGUAGES, type LangCode } from "@vochat/shared";
import { apiUrl, community, review, type HistoryEntry, type ReviewEntry } from "../api/client";
import { useSession } from "../session";
import { CommentThread } from "../components/CommentThread";
import { Empty, Lemma } from "../components/ui";
import { SpeakButton } from "../components/SpeakButton";
import { IconAlert, IconCheck, IconPlay } from "../components/icons";

type Filter = "open" | "suspicious" | "needs_fix" | "approved" | "recordings";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "open", label: "Offen" },
  { key: "suspicious", label: "Verdächtig" },
  { key: "needs_fix", label: "Mit Fehler" },
  { key: "approved", label: "Geprüft" },
  { key: "recordings", label: "Aufnahmen" },
];
const STATUS: Record<ReviewEntry["status"], string> = { unreviewed: "ungeprüft", approved: "geprüft", needs_fix: "Fehler gemeldet" };

const ACTION_LABEL: Record<string, string> = {
  "review.approve": "als geprüft markiert",
  "review.flag": "Fehler gemeldet",
  "sense.edit": "Bedeutung korrigiert",
  "sense.hide": "Bedeutung entfernt",
  "sense.add": "Bedeutung ergänzt",
  "translation.add": "Übersetzung ergänzt",
  "translation.hide": "Übersetzung entfernt",
  "pronunciation.set": "Aussprache gesetzt",
  "recording.add": "Aufnahme hochgeladen",
  "recording.approve": "Aufnahme freigegeben",
  "recording.hide": "Aufnahme entfernt",
  "recording.delete": "Aufnahme gelöscht",
  "contribution.verified": "Community-Beitrag verifiziert",
  "contribution.rejected": "Community-Beitrag abgelehnt",
  "contribution.revoked": "Community-Beitrag widerrufen",
};

/**
 * Expertenprüfung: Alle Einträge (auch importierte) gelten als ungeprüft, bis ein Experte sie prüft.
 * Verdächtige Einträge – ähnlich zu kürzlich korrigierten – stehen oben. Jede Aktion ist im Verlauf sichtbar.
 */
export function ReviewPage() {
  const { token, user } = useSession();
  const [langs, setLangs] = useState<LangCode[] | null>(null);
  const [lang, setLang] = useState<LangCode | null>(null);
  const [filter, setFilter] = useState<Filter>("open");
  const [data, setData] = useState<{ stats: { approved: number; needsFix: number; suspicious: number }; entries: ReviewEntry[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    community.me(token).then((me) => {
      const admin = me.roles.some((r) => r.role === "admin");
      const list = admin ? LANG_CODES : (me.roles.filter((r) => r.role === "expert").map((r) => r.lang) as LangCode[]);
      setLangs(list);
      setLang((cur) => cur ?? (list.includes(user.learnLangs[0]?.lang as LangCode) ? (user.learnLangs[0].lang as LangCode) : list[0] ?? null));
    });
  }, [token, user.learnLangs]);

  const [pages, setPages] = useState(1);
  const PAGE = 15;
  const load = () => {
    if (!token || !lang) return;
    // Nach einer Aktion neu laden, ohne die bereits geöffneten Seiten zu verlieren.
    review.queue(token, lang, filter, 0, PAGE * pages).then(setData).catch(() => setMsg("Warteschlange konnte nicht geladen werden."));
  };
  useEffect(load, [token, lang, filter, pages]);
  useEffect(() => setPages(1), [lang, filter]);

  if (!token) return <Empty>Die Expertenprüfung braucht ein Konto.</Empty>;
  if (langs === null) return <div className="muted">Lade …</div>;
  if (langs.length === 0) return <Empty>Diese Seite ist für Experten einer Sprache. Experten werden von Admins ernannt.</Empty>;

  const act = async (lexemeId: number, body: Record<string, unknown>) => {
    try {
      const r = await review.act(token, lexemeId, body);
      setMsg(r.suspicious > 0 ? `Gespeichert. ${r.suspicious} ähnliche Einträge wurden zur Prüfung vorgezogen.` : "Gespeichert.");
      load();
    } catch {
      setMsg("Aktion fehlgeschlagen.");
    }
  };

  return (
    <div className="stack">
      <div className="toolbar">
        <select value={lang ?? ""} onChange={(e) => setLang(e.target.value as LangCode)} aria-label="Sprache">
          {langs.map((l) => (
            <option key={l} value={l}>{LANGUAGES[l].name}</option>
          ))}
        </select>
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f.key} className={`chip ${filter === f.key ? "on" : ""}`} onClick={() => setFilter(f.key)}>{f.label}</button>
          ))}
        </div>
      </div>
      {data && (
        <div className="muted small">
          {data.stats.approved} geprüft · {data.stats.needsFix} mit Fehler · {data.stats.suspicious} verdächtig · alles andere ungeprüft
        </div>
      )}
      {msg && <div className="muted small" role="status">{msg}</div>}
      {data?.entries.length === 0 && <Empty>Nichts zu prüfen in dieser Ansicht.</Empty>}
      <ul className="list">
        {data?.entries.map((e) => (
          <ReviewCard key={e.id} entry={e} nativeLang={user.nativeLang} onAct={(body) => act(e.id, body)} />
        ))}
      </ul>
      {data && data.entries.length >= PAGE * pages && PAGE * pages < 50 && (
        <button onClick={() => setPages((p) => p + 1)}>Mehr laden</button>
      )}
    </div>
  );
}

function ReviewCard({ entry, nativeLang, onAct }: { entry: ReviewEntry; nativeLang: LangCode; onAct: (body: Record<string, unknown>) => void }) {
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [newSense, setNewSense] = useState("");
  const [newTr, setNewTr] = useState({ lang: "en" as LangCode, lemma: "" });
  const [pron, setPron] = useState(entry.romanization ?? "");
  const [panel, setPanel] = useState<"none" | "history" | "comments">("none");
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);

  useEffect(() => {
    if (panel === "history") review.history(entry.id).then(setHistory).catch(() => setHistory([]));
  }, [panel, entry.id]);

  return (
    <li className="card stack review-card">
      <div className="row">
        <Lemma lang={entry.lang}><span className="big-ish">{entry.lemma}</span></Lemma>
        <SpeakButton lang={entry.lang} text={entry.lemma} lexemeId={entry.id} />
        {entry.pos && <span className="muted small">{entry.pos}</span>}
        <span className={`badge status-${entry.status}`}>{STATUS[entry.status]}</span>
        {entry.reviewedBy && <span className="muted small">von {entry.reviewedBy}</span>}
        {entry.frequencyRank && <span className="muted small">Rang {entry.frequencyRank}</span>}
      </div>
      {entry.suspicions.length > 0 && (
        <div className="warn-box small">
          {entry.suspicions.map((s) => (
            <div key={s.reason} className="icon-line"><IconAlert size={14} aria-hidden /> {s.reason}</div>
          ))}
        </div>
      )}
      <div className="row">
        <input value={pron} onChange={(e) => setPron(e.target.value)} placeholder="Aussprache, z. B. āb" aria-label="Aussprache" style={{ flex: 1, minWidth: 0 }} />
        <button className="small-btn" disabled={pron === (entry.romanization ?? "")} onClick={() => onAct({ action: "setPronunciation", romanization: pron || null })}>Speichern</button>
      </div>
      <div className="stack" style={{ gap: "0.3rem" }}>
        <b className="small">Bedeutungen</b>
        {entry.senses.length === 0 && <span className="muted small">keine</span>}
        {entry.senses.map((s) => (
          <div key={s.id} className="row">
            {editing === s.id ? (
              <>
                <input value={editText} onChange={(e) => setEditText(e.target.value)} style={{ flex: 1 }} aria-label="Bedeutung korrigieren" />
                <button className="small-btn primary" disabled={!editText.trim()} onClick={() => { onAct({ action: "editSense", senseId: s.id, gloss: editText.trim() }); setEditing(null); }}>Speichern</button>
                <button className="small-btn" onClick={() => setEditing(null)}>Abbrechen</button>
              </>
            ) : (
              <div className="review-line">
                <span className="review-text">{s.gloss} <span className="muted small">{s.glossLang} · {s.source}</span></span>
                <span className="review-actions">
                  <button className="link small" onClick={() => { setEditing(s.id); setEditText(s.gloss); }}>Korrigieren</button>
                  <button className="link small danger" onClick={() => onAct({ action: "hideSense", senseId: s.id })}>Entfernen</button>
                </span>
              </div>
            )}
          </div>
        ))}
        <div className="row">
          <input value={newSense} onChange={(e) => setNewSense(e.target.value)} placeholder={`Bedeutung ergänzen (${nativeLang})`} style={{ flex: 1 }} aria-label="Bedeutung ergänzen" />
          <button className="small-btn" disabled={!newSense.trim()} onClick={() => { onAct({ action: "addSense", glossLang: nativeLang, gloss: newSense.trim() }); setNewSense(""); }}>Hinzufügen</button>
        </div>
      </div>
      <div className="stack" style={{ gap: "0.3rem" }}>
        <b className="small">Übersetzungen</b>
        {entry.translations.length === 0 && <span className="muted small">keine</span>}
        {entry.translations.map((t) => (
          <div key={t.id} className="review-line">
            <span className="review-text">{t.targetLemma} <span className="muted small">{t.targetLang} · {t.source}</span></span>
            <span className="review-actions">
              <button className="link small danger" onClick={() => onAct({ action: "hideTranslation", translationId: t.id })}>Entfernen</button>
            </span>
          </div>
        ))}
        <div className="row">
          <select value={newTr.lang} onChange={(e) => setNewTr({ ...newTr, lang: e.target.value as LangCode })} aria-label="Zielsprache" style={{ width: "auto" }}>
            {LANG_CODES.filter((l) => l !== entry.lang).map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <input value={newTr.lemma} onChange={(e) => setNewTr({ ...newTr, lemma: e.target.value })} placeholder="Übersetzung ergänzen" style={{ flex: 1 }} aria-label="Übersetzung ergänzen" />
          <button className="small-btn" disabled={!newTr.lemma.trim()} onClick={() => { onAct({ action: "addTranslation", targetLang: newTr.lang, targetLemma: newTr.lemma.trim() }); setNewTr({ ...newTr, lemma: "" }); }}>Hinzufügen</button>
        </div>
      </div>
      {entry.recordings.length > 0 && (
        <div className="stack" style={{ gap: "0.3rem" }}>
          <b className="small">Aufnahmen</b>
          {entry.recordings.map((r) => (
            <div key={r.id} className="review-line">
              <span className="review-text">
                <button className="small-btn" onClick={() => void new Audio(apiUrl(r.url)).play()}><IconPlay size={13} aria-hidden /> {r.speaker ?? "?"}</button>{" "}
                {r.status === "pending" ? <span className="badge subtle">wartet</span> : <span className="muted small">freigegeben</span>}
              </span>
              <span className="review-actions">
                {r.status === "pending" && (
                  <button className="link small" onClick={() => onAct({ action: "approveRecording", recordingId: r.id })}>Freigeben</button>
                )}
                <button className="link small danger" onClick={() => onAct({ action: "hideRecording", recordingId: r.id })}>Entfernen</button>
              </span>
            </div>
          ))}
        </div>
      )}
      {entry.examples.length > 0 && (
        <ul className="examples small">
          {entry.examples.map((x) => (
            <li key={x.id}><Lemma lang={entry.lang}>{x.text}</Lemma>{x.translation ? ` – ${x.translation}` : ""}</li>
          ))}
        </ul>
      )}
      <div className="row">
        <button className="small-btn primary" onClick={() => onAct({ action: "approve" })}><IconCheck size={15} aria-hidden /> Geprüft</button>
        <button
          className="small-btn"
          onClick={() => {
            const note = window.prompt("Was ist falsch?");
            if (note?.trim()) onAct({ action: "flag", note: note.trim() });
          }}
        >
          <IconAlert size={15} aria-hidden /> Fehler melden
        </button>
        <span className="spacer" />
        <button className="link small" onClick={() => setPanel(panel === "history" ? "none" : "history")}>Verlauf</button>
        <button className="link small" onClick={() => setPanel(panel === "comments" ? "none" : "comments")}>Diskussion</button>
      </div>
      {panel === "history" && (
        <ul className="history small">
          {history === null && <li className="muted">Lade …</li>}
          {history?.length === 0 && <li className="muted">Noch keine Änderungen.</li>}
          {history?.map((h) => (
            <li key={h.id}>
              <span className="muted">{new Date(h.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>{" "}
              <b>{h.actor?.name ?? "System"}</b> {ACTION_LABEL[h.action] ?? h.action}
              {h.details && "from" in h.details ? ` („${String(h.details.from ?? "–")}“ → „${String(h.details.to ?? "–")}“)` : ""}
              {h.details && "note" in h.details && h.details.note ? `: ${String(h.details.note)}` : ""}
            </li>
          ))}
        </ul>
      )}
      {panel === "comments" && <CommentThread target={`lexeme:${entry.id}`} />}
    </li>
  );
}
