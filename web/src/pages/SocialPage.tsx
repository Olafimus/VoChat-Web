import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { social, type FeedItem, type PersonRef } from "../api/client";
import { useSession } from "../session";
import { Avatar } from "../components/Avatar";
import { Empty } from "../components/ui";

type Tab = "feed" | "freunde" | "suchen" | "anfragen";

/** Freunde und Follower: Aktivitäts-Feed, Freundesliste, Suche, offene Anfragen. */
export function SocialPage() {
  const { token } = useSession();
  const [tab, setTab] = useState<Tab>("feed");
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!token) return;
    social.requests(token).then((r) => setPending(r.friends.length + r.follows.length)).catch(() => setPending(0));
  }, [token, tab]);

  if (!token) return <Empty>Für Freunde und Follower brauchst du ein Konto (Profil → Konto).</Empty>;
  return (
    <div className="stack">
      <div className="segmented four" role="tablist">
        <button className={tab === "feed" ? "on" : ""} onClick={() => setTab("feed")}>Feed</button>
        <button className={tab === "freunde" ? "on" : ""} onClick={() => setTab("freunde")}>Freunde</button>
        <button className={tab === "suchen" ? "on" : ""} onClick={() => setTab("suchen")}>Suchen</button>
        <button className={tab === "anfragen" ? "on" : ""} onClick={() => setTab("anfragen")}>
          Anfragen{pending > 0 ? ` (${pending})` : ""}
        </button>
      </div>
      {tab === "feed" && <Feed token={token} />}
      {tab === "freunde" && <Friends token={token} />}
      {tab === "suchen" && <Search token={token} />}
      {tab === "anfragen" && <Requests token={token} onChange={() => setPending((n) => n)} />}
    </div>
  );
}

function PersonRow({ p, children }: { p: PersonRef; children?: React.ReactNode }) {
  return (
    <li className="card row-card person-row">
      <Avatar name={p.name} url={p.avatarUrl} />
      <Link to={`/users/${p.id}`} className="person-name">{p.name}</Link>
      {p.isPrivate && <span className="badge subtle">privat</span>}
      <span className="spacer" />
      {children}
    </li>
  );
}

function Feed({ token }: { token: string }) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    social.feed(token).then(setItems).catch(() => setItems([]));
  }, [token]);
  if (items === null) return <div className="muted">Lade …</div>;
  if (items.length === 0) return <Empty>Noch nichts Neues. Folge Leuten oder füge Freunde hinzu.</Empty>;
  return (
    <ul className="list">
      {items.map((i, idx) => (
        <li key={`${i.type}-${idx}-${i.at}`} className="card row-card">
          <div className="row">
            <Link to={`/users/${i.userId}`} className="person-name">{i.userName}</Link>
            <span className="muted small">{i.type === "collection" ? "hat geteilt" : "hat etwas beigetragen"}</span>
          </div>
          <div><b>{i.title}</b> <span className="muted small">{i.detail}</span></div>
        </li>
      ))}
    </ul>
  );
}

function Friends({ token }: { token: string }) {
  const [list, setList] = useState<PersonRef[] | null>(null);
  const load = () => social.friends(token).then(setList).catch(() => setList([]));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  if (list === null) return <div className="muted">Lade …</div>;
  if (list.length === 0) return <Empty>Noch keine Freunde. Suche nach Leuten und sende eine Anfrage.</Empty>;
  return (
    <ul className="list">
      {list.map((p) => (
        <PersonRow key={p.id} p={p}>
          <button className="small-btn danger" onClick={() => social.unfriend(token, p.id).then(load)}>Entfernen</button>
        </PersonRow>
      ))}
    </ul>
  );
}

function Search({ token }: { token: string }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PersonRef[]>([]);
  const [states, setStates] = useState<Record<string, { following: string; friend: string }>>({});

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      social.search(token, q).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, token]);

  const follow = async (p: PersonRef) => {
    const r = await social.follow(token, p.id);
    setStates((s) => ({ ...s, [p.id]: { ...s[p.id], following: r.state, friend: s[p.id]?.friend ?? "none" } }));
  };
  const befriend = async (p: PersonRef) => {
    const r = await social.befriend(token, p.id);
    setStates((s) => ({ ...s, [p.id]: { ...s[p.id], following: s[p.id]?.following ?? "none", friend: r.state } }));
  };

  return (
    <div className="stack">
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name suchen (mind. 2 Zeichen)" aria-label="Personen suchen" />
      {q.trim().length >= 2 && results.length === 0 && <Empty>Niemand gefunden. Nur öffentliche Profile sind sichtbar.</Empty>}
      <ul className="list">
        {results.map((p) => {
          const st = states[p.id];
          return (
            <PersonRow key={p.id} p={p}>
              <button className="small-btn" onClick={() => follow(p)} disabled={st?.following === "accepted" || st?.following === "requested"}>
                {st?.following === "accepted" ? "Folge ich" : st?.following === "requested" ? "angefragt" : "Folgen"}
              </button>
              <button className="small-btn" onClick={() => befriend(p)} disabled={st?.friend === "accepted" || st?.friend === "outgoing"}>
                {st?.friend === "accepted" ? "Freund" : st?.friend === "outgoing" ? "Anfrage gesendet" : "Freundschaft"}
              </button>
            </PersonRow>
          );
        })}
      </ul>
    </div>
  );
}

function Requests({ token, onChange }: { token: string; onChange: () => void }) {
  const [data, setData] = useState<{ friends: PersonRef[]; follows: PersonRef[] } | null>(null);
  const load = () => social.requests(token).then(setData).catch(() => setData({ friends: [], follows: [] }));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  if (data === null) return <div className="muted">Lade …</div>;
  const none = data.friends.length === 0 && data.follows.length === 0;
  return (
    <div className="stack">
      {none && <Empty>Keine offenen Anfragen.</Empty>}
      {data.friends.length > 0 && <h2>Freundschaftsanfragen</h2>}
      <ul className="list">
        {data.friends.map((p) => (
          <PersonRow key={`f-${p.id}`} p={p}>
            <button className="small-btn primary" onClick={() => social.friendRespond(token, p.id, "accept").then(() => { void load(); onChange(); })}>Annehmen</button>
            <button className="small-btn" onClick={() => social.friendRespond(token, p.id, "decline").then(() => { void load(); onChange(); })}>Ablehnen</button>
          </PersonRow>
        ))}
      </ul>
      {data.follows.length > 0 && <h2>Follow-Anfragen</h2>}
      <ul className="list">
        {data.follows.map((p) => (
          <PersonRow key={`o-${p.id}`} p={p}>
            <button className="small-btn primary" onClick={() => social.followRespond(token, p.id, "accept").then(() => { void load(); onChange(); })}>Zulassen</button>
            <button className="small-btn" onClick={() => social.followRespond(token, p.id, "decline").then(() => { void load(); onChange(); })}>Ablehnen</button>
          </PersonRow>
        ))}
      </ul>
    </div>
  );
}
