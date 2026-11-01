import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { chat, social, type PersonRef } from "../api/client";
import { useSession } from "../session";
import { useConversations } from "../lib/useChats";
import { Avatar } from "../components/Avatar";
import { PageHeader } from "../components/PageHeader";
import { IconChats, IconGroup, IconPlus } from "../components/icons";
import { IconClose, IconDictionary } from "../components/icons";

const when = (t: number) => {
  const d = new Date(t);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (Date.now() - t < 6 * 86_400_000) return d.toLocaleDateString("de-DE", { weekday: "short" });
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
};

/** Chats: Wörterbuch-Assistent (lokal) und Unterhaltungen mit Freunden und Gruppen. */
export function ChatsPage() {
  const { token, user } = useSession();
  const { list, error } = useConversations(token);
  const [creating, setCreating] = useState<"dm" | "group" | null>(null);

  return (
    <div className="stack chats">
      <PageHeader
        icon={<IconChats size={22} />}
        title="Chats"
        subtitle="Mit Freunden schreiben, korrigieren, Wörter sammeln"
        actions={
          token && (
            <>
              <button className="small-btn" onClick={() => setCreating(creating === "dm" ? null : "dm")}><IconPlus size={15} aria-hidden /> Chat</button>
              <button className="small-btn" onClick={() => setCreating(creating === "group" ? null : "group")}><IconGroup size={15} aria-hidden /> Gruppe</button>
            </>
          )
        }
      />
      {creating && <NewChat kind={creating} onClose={() => setCreating(null)} />}

      <ul className="conv-list card">
        <li>
          <Link to="/chat/assistant" className="conv-item">
            <span className="avatar assistant" aria-hidden><IconDictionary size={22} /></span>
            <span className="conv-main">
              <b>Wörterbuch-Assistent</b>
              <span className="muted small">Nachschlagen, Texte auswerten, eigene Sätze korrigieren</span>
            </span>
          </Link>
        </li>
        {list?.map((c) => {
          const other = c.members.find((m) => m.id !== user.id);
          const mineLast = c.lastMessage?.authorId === user.id;
          return (
            <li key={c.id}>
              <Link to={`/chat/${c.id}`} className={`conv-item ${c.unread ? "unread" : ""}`}>
                <Avatar name={c.title} url={c.kind === "group" ? null : (other?.avatarUrl ?? null)} size={44} />
                <span className="conv-main">
                  <span className="row conv-top">
                    <b className="conv-name">{c.title}</b>
                    <span className="spacer" />
                    {c.lastMessage && <span className="muted small">{when(c.lastMessage.at)}</span>}
                  </span>
                  <span className="row conv-top">
                    <span className="conv-preview muted small">
                      {c.lastMessage ? `${mineLast ? "Du: " : c.kind === "group" ? `${c.members.find((m) => m.id === c.lastMessage!.authorId)?.name ?? "?"}: ` : ""}${c.lastMessage.preview}` : "Noch keine Nachrichten"}
                    </span>
                    <span className="spacer" />
                    {c.unread > 0 && <span className="unread-badge" aria-label={`${c.unread} ungelesen`}>{c.unread > 99 ? "99+" : c.unread}</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!token && (
        <div className="card small">
          Chats mit Freunden brauchen ein <Link to="/profile">Konto</Link>. Der Wörterbuch-Assistent funktioniert auch ohne.
        </div>
      )}
      {error && <div className="muted small">Offline – die Chat-Liste wird geladen, sobald du verbunden bist.</div>}
      {list?.length === 0 && token && <div className="muted small">Noch keine Chats. Starte einen mit einem Freund.</div>}
    </div>
  );
}

function NewChat({ kind, onClose }: { kind: "dm" | "group"; onClose: () => void }) {
  const { token } = useSession();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<PersonRef[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (token) social.friends(token).then(setFriends).catch(() => setFriends([]));
  }, [token]);
  if (!token) return null;
  const open = async (userId: string) => {
    try {
      const { id } = await chat.openDm(token, userId);
      navigate(`/chat/${id}`);
    } catch {
      setError("Chat konnte nicht geöffnet werden.");
    }
  };
  const createGroup = async () => {
    try {
      const { id } = await chat.createGroup(token, title.trim(), [...picked]);
      navigate(`/chat/${id}`);
    } catch {
      setError("Gruppe konnte nicht erstellt werden.");
    }
  };
  return (
    <div className="card stack">
      <div className="row">
        <b>{kind === "dm" ? "Chat mit …" : "Neue Gruppe"}</b>
        <span className="spacer" />
        <button className="link small" onClick={onClose} aria-label="Schließen"><IconClose size={16} /></button>
      </div>
      {kind === "group" && <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name der Gruppe" maxLength={80} aria-label="Name der Gruppe" />}
      {friends?.length === 0 && (
        <div className="muted small">
          Du hast noch keine Freunde. <Link to="/community?tab=freunde">Freunde finden</Link>
        </div>
      )}
      <ul className="list compact">
        {friends?.map((f) =>
          kind === "dm" ? (
            <li key={f.id}>
              <button className="person-row" onClick={() => void open(f.id)}>
                <Avatar name={f.name} url={f.avatarUrl} size={32} /> {f.name}
              </button>
            </li>
          ) : (
            <li key={f.id}>
              <label className="inline">
                <input
                  type="checkbox"
                  checked={picked.has(f.id)}
                  onChange={() => setPicked((p) => (p.has(f.id) ? new Set([...p].filter((x) => x !== f.id)) : new Set([...p, f.id])))}
                />
                <Avatar name={f.name} url={f.avatarUrl} size={28} /> {f.name}
              </label>
            </li>
          ),
        )}
      </ul>
      {kind === "group" && (
        <button className="primary" disabled={!title.trim() || picked.size === 0} onClick={() => void createGroup()}>
          Gruppe erstellen ({picked.size})
        </button>
      )}
      {error && <div className="error small">{error}</div>}
    </div>
  );
}
