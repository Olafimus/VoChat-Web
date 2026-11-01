import { useEffect, useState, type FormEvent } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { coverage, LANGUAGES, type ChallengeDetail, type ChallengeSummary, type LangCode } from "@vochat/shared";
import { ApiError, challenges, social, type PersonRef } from "../api/client";
import { useSession } from "../session";
import { useActiveLang } from "../lib/lang";
import { addCard } from "../lib/cards";
import type { CardRow, MediaCollectionRow } from "../local/collections";
import { Avatar } from "../components/Avatar";
import { CommentThread } from "../components/CommentThread";
import { Empty } from "../components/ui";
import { WordView } from "../components/WordView";

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
const daysLeft = (end: number) => Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
const KIND: Record<ChallengeSummary["kind"], string> = { duel: "Duell", group: "Gruppe", weekly: "Wochen-Challenge" };

/** Gemeinsam lernen: Wochen-Challenges, Duelle und Gruppen mit Freunden, Rangliste und Vergleich. */
export function ChallengesPage() {
  const { token } = useSession();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  if (!token) return <Empty>Für Challenges brauchst du ein Konto (Profil → Konto).</Empty>;
  if (open) return <ChallengeView id={open} onBack={() => setOpen(null)} />;
  if (creating) return <CreateChallenge onDone={(id) => { setCreating(false); if (id) setOpen(id); }} />;
  return <ChallengeOverview onOpen={setOpen} onCreate={() => setCreating(true)} />;
}

function ChallengeOverview({ onOpen, onCreate }: { onOpen: (id: string) => void; onCreate: () => void }) {
  const { token } = useSession();
  const [, , learning] = useActiveLang();
  const [weekly, setWeekly] = useState<ChallengeDetail[]>([]);
  const [mine, setMine] = useState<ChallengeSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [list, ...weeks] = await Promise.all([challenges.list(token!), ...learning.map((l) => challenges.weekly(token!, l))]);
      setMine(list.filter((c) => c.kind !== "weekly" || c.myStatus === "accepted"));
      setWeekly(weeks.filter((w): w is ChallengeDetail => !!w));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 0 ? "Offline – Challenges brauchen eine Verbindung." : "Laden fehlgeschlagen.");
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, learning.join(",")]);

  const respond = async (id: string, action: "accept" | "decline" | "join") => {
    await challenges.act(token!, id, action);
    await load();
  };

  return (
    <div className="stack">
      {error && <div className="error">{error}</div>}
      <section className="stack">
        <h2>Diese Woche</h2>
        {weekly.length === 0 && <Empty>Für deine Lernsprachen gibt es diese Woche noch keine Challenge.</Empty>}
        {weekly.map((w) => (
          <div key={w.id} className="card row-card">
            <div className="row">
              <b>{LANGUAGES[w.lang as LangCode]?.name}</b>
              <span className="muted small">{w.itemCount} Wörter · bis {fmtDate(w.endsAt)} · {w.members} dabei</span>
              <span className="spacer" />
              {w.myStatus === "accepted" ? (
                <button className="small-btn" onClick={() => onOpen(w.id)}>Öffnen</button>
              ) : (
                <button className="small-btn primary" onClick={() => respond(w.id, "join").then(() => onOpen(w.id))}>Mitmachen</button>
              )}
            </div>
          </div>
        ))}
      </section>

      <section className="stack">
        <div className="row">
          <h2>Mit Freunden</h2>
          <span className="spacer" />
          <button className="small-btn primary" onClick={onCreate}>+ Arbeitsbuch schicken</button>
        </div>
        {mine === null && !error && <div className="muted">Lade …</div>}
        {mine?.filter((c) => c.kind !== "weekly").length === 0 && <Empty>Schick Freunden ein Arbeitsbuch und lernt um die Wette.</Empty>}
        <ul className="list">
          {mine?.filter((c) => c.kind !== "weekly").map((c) => (
            <li key={c.id} className="card row-card">
              <div className="row">
                <button className="link" onClick={() => onOpen(c.id)}>{c.title}</button>
                <span className="badge subtle">{KIND[c.kind]}</span>
                <span className="muted small">{c.itemCount} Wörter · {c.endsAt > Date.now() ? `noch ${daysLeft(c.endsAt)} Tage` : "beendet"}</span>
                <span className="spacer" />
                {c.myStatus === "invited" ? (
                  <>
                    <span className="muted small">von {c.creatorName}</span>
                    <button className="small-btn primary" onClick={() => respond(c.id, "accept")}>Annehmen</button>
                    <button className="small-btn" onClick={() => respond(c.id, "decline")}>Ablehnen</button>
                  </>
                ) : (
                  <span className="muted small">{c.members} dabei</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ChallengeView({ id, onBack }: { id: string; onBack: () => void }) {
  const { token, collections } = useSession();
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];
  const [detail, setDetail] = useState<ChallengeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () =>
    challenges
      .get(token!, id)
      .then(setDetail)
      .catch(() => setError("Challenge nicht verfügbar."));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <div className="error">{error}</div>;
  if (!detail) return <div className="muted">Lade …</div>;
  const cov = coverage(detail.items, cards);
  const lang = detail.lang as LangCode;
  const learnMissing = () =>
    cov.missing.forEach((i) =>
      addCard(collections, { lang, lemma: i.lemma, lexemeId: i.lexemeId, gloss: i.gloss, pronunciation: i.pronunciation, cefr: i.cefr }),
    );

  return (
    <div className="stack">
      <button onClick={onBack}>← Zurück</button>
      <div className="card stack">
        <div className="row">
          <h2>{detail.title}</h2>
          <span className="badge subtle">{KIND[detail.kind]}</span>
        </div>
        <div className="muted small">
          {LANGUAGES[lang]?.name} · {fmtDate(detail.startsAt)}–{fmtDate(detail.endsAt)} · {detail.endsAt > Date.now() ? `noch ${daysLeft(detail.endsAt)} Tage` : "beendet"}
        </div>
        <div className="muted small">Punkte: bekanntes Challenge-Wort 10, richtige Antwort zu einem Challenge-Wort 1. Teilnehmende sehen den Fortschritt bei diesen Wörtern.</div>
        <div className="row">
          <span>Du kennst {cov.known} von {cov.total} · {cov.learning} in Arbeit</span>
          <span className="spacer" />
          <button className="small-btn primary" disabled={cov.missing.length === 0} onClick={learnMissing}>Fehlende lernen ({cov.missing.length})</button>
          <button className="small-btn" onClick={() => challenges.act(token!, id, "leave").then(onBack)}>Verlassen</button>
        </div>
      </div>
      <section className="card stack">
        <h2>Rangliste</h2>
        <table className="board">
          <thead>
            <tr><th>#</th><th>Name</th><th title="bekannte Challenge-Wörter">Wörter</th><th title="richtige Antworten">✓</th><th title="Punkte">Pkt.</th></tr>
          </thead>
          <tbody>
            {detail.leaderboard.map((e, i) => (
              <tr key={`${e.userId ?? "anon"}-${i}`} className={e.isMe ? "me" : ""}>
                <td>{i + 1}</td>
                <td><span className="row"><Avatar name={e.name} url={e.avatarUrl} size={24} />{e.name}</span></td>
                <td>{e.known}/{detail.itemCount}</td>
                <td>{e.correct}</td>
                <td><b>{e.points}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
        {detail.invited.length > 0 && <div className="muted small">Eingeladen: {detail.invited.map((p) => p.name).join(", ")}</div>}
      </section>
      <section className="card stack">
        <h2>Wörter</h2>
        <ul className="list">
          {detail.items.map((i) => (
            <li key={`${i.lemma}-${i.lexemeId ?? ""}`} className="row card-line">
              <WordView lexemeId={i.lexemeId} lemma={i.lemma} lang={lang} pronunciation={i.pronunciation} gloss={i.gloss} cefr={i.cefr} />
            </li>
          ))}
        </ul>
      </section>
      <section className="card stack">
        <h2>Kommentare</h2>
        <CommentThread target={`challenge:${id}`} />
      </section>
    </div>
  );
}

function CreateChallenge({ onDone }: { onDone: (id: string | null) => void }) {
  const { token, collections } = useSession();
  const own = ((useLiveQuery((q) => collections.collections).data ?? []) as MediaCollectionRow[]).filter((c) => !c.deleted && c.items.length > 0);
  const [friends, setFriends] = useState<PersonRef[] | null>(null);
  const [collectionId, setCollectionId] = useState<string>("");
  const [invite, setInvite] = useState<string[]>([]);
  const [days, setDays] = useState(7);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    social.friends(token!).then(setFriends).catch(() => setFriends([]));
  }, [token]);

  const chosen = own.find((c) => c.id === collectionId);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chosen || invite.length === 0) return;
    try {
      const res = await challenges.create(token!, {
        kind: invite.length === 1 ? "duel" : "group",
        title: title.trim() || chosen.title,
        lang: chosen.lang,
        days,
        invite,
        items: chosen.items.map((i) => ({ lemma: i.lemma, lang: i.lang as LangCode, lexemeId: i.lexemeId, gloss: i.gloss, pronunciation: i.pronunciation ?? null, cefr: (i.cefr as never) ?? null })),
      });
      onDone(res.id);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? "Nur Freunde können eingeladen werden." : "Challenge konnte nicht erstellt werden.");
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Arbeitsbuch schicken</h2>
      {own.length === 0 && <div className="muted">Lege zuerst unter „Lernpfade → Meine“ eine Sammlung an.</div>}
      <label>
        Arbeitsbuch (eigene Sammlung)
        <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} required>
          <option value="">– auswählen –</option>
          {own.map((c) => (
            <option key={c.id} value={c.id}>{c.title} ({c.items.length} Wörter, {LANGUAGES[c.lang as LangCode]?.name})</option>
          ))}
        </select>
      </label>
      <label>
        Titel (optional)
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder={chosen?.title ?? ""} />
      </label>
      <fieldset>
        <legend>Freunde einladen</legend>
        {friends === null && <div className="muted small">Lade …</div>}
        {friends?.length === 0 && <div className="muted small">Noch keine Freunde. Füge unter „Freunde“ welche hinzu.</div>}
        {friends?.map((f) => (
          <label key={f.id} className="inline">
            <input type="checkbox" checked={invite.includes(f.id)} onChange={(e) => setInvite((v) => (e.target.checked ? [...v, f.id] : v.filter((x) => x !== f.id)))} />
            {f.name}
          </label>
        ))}
      </fieldset>
      <label>
        Dauer
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          {[3, 7, 14, 30].map((d) => (
            <option key={d} value={d}>{d} Tage</option>
          ))}
        </select>
      </label>
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="primary" disabled={!chosen || invite.length === 0}>{invite.length > 1 ? "Gruppe starten" : "Duell starten"}</button>
        <button type="button" onClick={() => onDone(null)}>Abbrechen</button>
      </div>
    </form>
  );
}
