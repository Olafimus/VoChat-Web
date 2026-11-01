import { useEffect, useMemo, useState, type FormEvent } from "react";
import { comments as api, type CommentView } from "../api/client";
import { useSession } from "../session";
import { Avatar } from "./Avatar";

/**
 * Kommentar-Baum zu einem Ziel (Beitrag, Eintrag, Sammlung, Challenge). Antworten sind beliebig tief,
 * jeder Kommentar lässt sich mit 👍/👎 bewerten. Die Bewertungen fließen in die Punkte der Verfassenden.
 */
export function CommentThread({ target }: { target: string }) {
  const { token, user } = useSession();
  const [list, setList] = useState<CommentView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    token
      ? api.list(token, target).then(setList).catch(() => setError("Kommentare konnten nicht geladen werden."))
      : Promise.resolve();

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, token]);

  const children = useMemo(() => {
    const map = new Map<number | null, CommentView[]>();
    for (const c of list ?? []) {
      const key = c.parentId;
      map.set(key, [...(map.get(key) ?? []), c]);
    }
    return map;
  }, [list]);

  if (!token) return <div className="muted small">Kommentare gibt es mit Konto.</div>;
  if (error) return <div className="error small">{error}</div>;
  if (!list) return <div className="muted small">Lade Kommentare …</div>;

  const act = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await load();
    } catch {
      setError("Aktion fehlgeschlagen.");
    }
  };

  const ctx: NodeContext = { childrenOf: (id) => children.get(id) ?? [], act, token, userId: user.id, target };

  return (
    <div className="stack comments">
      <Composer onSubmit={(text) => act(() => api.add(token, target, text, null))} placeholder="Kommentar schreiben …" />
      {list.length === 0 && <div className="muted small">Noch keine Kommentare.</div>}
      <ul className="comment-list">{(children.get(null) ?? []).map((c) => <CommentNode key={c.id} c={c} depth={0} ctx={ctx} />)}</ul>
    </div>
  );
}

interface NodeContext {
  childrenOf: (id: number) => CommentView[];
  act: (fn: () => Promise<unknown>) => Promise<void>;
  token: string;
  userId: string;
  target: string;
}

function CommentNode({ c, depth, ctx }: { c: CommentView; depth: number; ctx: NodeContext }) {
  const [replying, setReplying] = useState(false);
  const mine = c.author?.id === ctx.userId;
  const replies = ctx.childrenOf(c.id);
  return (
    <li className="comment" style={{ marginInlineStart: depth ? "1rem" : 0 }}>
      <div className="row comment-head">
        {c.author ? <Avatar name={c.author.name} url={c.author.avatarUrl} size={22} /> : null}
        <b className="small">{c.author?.name ?? "gelöscht"}</b>
        <span className="muted small">
          {new Date(c.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
          {c.editedAt ? " · bearbeitet" : ""}
        </span>
      </div>
      <div className={c.body === null ? "muted small" : ""}>{c.body ?? "Kommentar entfernt"}</div>
      <div className="row comment-actions">
        <button className={`link small ${c.myVote === 1 ? "on" : ""}`} disabled={mine || c.body === null} onClick={() => ctx.act(() => api.vote(ctx.token, c.id, c.myVote === 1 ? 0 : 1))} aria-label="Hilfreich">👍</button>
        <span className="small">{c.score}</span>
        <button className={`link small ${c.myVote === -1 ? "on" : ""}`} disabled={mine || c.body === null} onClick={() => ctx.act(() => api.vote(ctx.token, c.id, c.myVote === -1 ? 0 : -1))} aria-label="Nicht hilfreich">👎</button>
        {c.body !== null && <button className="link small" onClick={() => setReplying((v) => !v)}>Antworten</button>}
        {mine && c.body !== null && <button className="link small danger" onClick={() => ctx.act(() => api.remove(ctx.token, c.id))}>Löschen</button>}
      </div>
      {replying && (
        <Composer
          onSubmit={(text) => ctx.act(() => api.add(ctx.token, ctx.target, text, c.id)).then(() => setReplying(false))}
          placeholder="Antwort …"
        />
      )}
      {replies.length > 0 && (
        <ul className="comment-list">{replies.map((r) => <CommentNode key={r.id} c={r} depth={Math.min(depth + 1, 6)} ctx={ctx} />)}</ul>
      )}
    </li>
  );
}

function Composer({ onSubmit, placeholder }: { onSubmit: (text: string) => Promise<unknown> | void; placeholder: string }) {
  const [text, setText] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onSubmit(text.trim());
    setText("");
  };
  return (
    <form className="row" onSubmit={submit}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={2000} style={{ flex: 1 }} />
      <button className="small-btn" disabled={!text.trim()}>Senden</button>
    </form>
  );
}
