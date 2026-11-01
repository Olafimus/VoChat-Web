import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, people, social, type PublicUserView } from "../api/client";
import type { CatalogCollection } from "@vochat/shared";
import { useSession } from "../session";
import { Avatar } from "../components/Avatar";
import { Empty } from "../components/ui";

/** Öffentliches Profil: Bio, Statistik, Lernfortschritt (für Freunde), öffentliche Sammlungen, Follow/Freundschaft. */
export function UserPage() {
  const { id = "" } = useParams();
  const { token, user } = useSession();
  const [view, setView] = useState<PublicUserView | null>(null);
  const [collections, setCollections] = useState<CatalogCollection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const isSelf = user.id === id;

  const load = () =>
    people
      .get(id, token)
      .then(setView)
      .catch(() => setError("Profil nicht gefunden."));

  useEffect(() => {
    void load();
    api.publicCollections({ owner: id }, token).then(setCollections).catch(() => setCollections([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  if (error) return <Empty>{error}</Empty>;
  if (!view) return <div className="muted">Lade …</div>;

  const act = async (fn: () => Promise<unknown>) => {
    await fn();
    await load();
  };

  return (
    <div className="stack">
      <div className="card stack">
        <div className="row">
          <Avatar name={view.name} url={view.avatarUrl} size={72} />
          <div className="stack" style={{ gap: "0.2rem" }}>
            <h2>{view.name}</h2>
            {view.isPrivate && <span className="badge subtle">privates Profil</span>}
          </div>
        </div>
        {view.bio && <p>{view.bio}</p>}
        {view.stats && (
          <div className="row muted small">
            <span>{view.stats.followers} Follower</span>
            <span>· {view.stats.following} folgt</span>
            <span>· {view.stats.publicCollections} geteilte Sammlungen</span>
            <span>· {view.stats.verifiedContributions} verifizierte Beiträge</span>
          </div>
        )}
        {view.progress && (
          <div className="small">Lernfortschritt: {view.progress.known} bekannt · {view.progress.learning} in Arbeit</div>
        )}
        {token && !isSelf && (
          <div className="row">
            {view.relation.following === "accepted" ? (
              <button onClick={() => act(() => social.unfollow(token, id))}>Entfolgen</button>
            ) : view.relation.following === "requested" ? (
              <button disabled>Follow angefragt</button>
            ) : (
              <button className="primary" onClick={() => act(() => social.follow(token, id))}>Folgen</button>
            )}
            {view.relation.friend === "accepted" && <button onClick={() => act(() => social.unfriend(token, id))}>Freundschaft beenden</button>}
            {view.relation.friend === "none" && <button onClick={() => act(() => social.befriend(token, id))}>Freundschaftsanfrage</button>}
            {view.relation.friend === "outgoing" && <button disabled>Anfrage gesendet</button>}
            {view.relation.friend === "incoming" && <button className="primary" onClick={() => act(() => social.friendRespond(token, id, "accept"))}>Anfrage annehmen</button>}
          </div>
        )}
      </div>
      {!isSelf && view.isPrivate && view.relation.following !== "accepted" && <Empty>Dieses Profil ist privat. Folge dieser Person, um mehr zu sehen.</Empty>}
      {collections.length > 0 && (
        <section className="stack">
          <h2>Geteilte Sammlungen</h2>
          <ul className="list">
            {collections.map((c) => (
              <li key={c.id} className="card row-card">
                <b>{c.title}</b> <span className="muted small">{c.kind === "path" ? "Lernpfad" : "Medium"} · {c.itemCount} Wörter</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
