import { memo, useState } from "react";
import { apiUrl } from "../../api/client";
import type { LocalMessage } from "../../lib/chatStore";
import { isEmojiOnly, linkify } from "../../lib/linkify";
import { DiffText } from "../DiffText";
import { QUICK_REACTIONS } from "./EmojiPicker";
import { VoicePlayer } from "./VoicePlayer";
import { IconAlert, IconCheck, IconCheckCheck, IconClock, IconEdit, IconMore } from "../icons";

export interface BubbleActions {
  reply(m: LocalMessage): void;
  react(m: LocalMessage, emoji: string): void;
  edit(m: LocalMessage): void;
  remove(m: LocalMessage): void;
  correct(m: LocalMessage): void;
  learn(m: LocalMessage): void;
  openImage(url: string): void;
  jumpTo(id: number): void;
  retry(m: LocalMessage): void;
}

const time = (t: number) => new Date(t).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
const mediaSrc = (m: LocalMessage) => (m.media ? (m.localUrl && m.media.url === m.localUrl ? m.localUrl : apiUrl(m.media.url)) : "");

/**
 * Eine Nachricht. Text wird nie als HTML eingesetzt: Links erkennt `linkify` (nur http/https),
 * alles andere escaped React. Memoisiert: ändert sich nur eine Nachricht, rendert nur sie neu.
 */
export const MessageBubble = memo(function MessageBubble({
  m,
  mine,
  authorName,
  showAuthor,
  read,
  correctorName,
  actions,
}: {
  m: LocalMessage;
  mine: boolean;
  authorName: string;
  showAuthor: boolean;
  read: boolean;
  correctorName: string | null;
  actions: BubbleActions;
}) {
  const [menu, setMenu] = useState(false);
  if (m.deleted) {
    return (
      <div className={`msg ${mine ? "mine" : "theirs"}`}>
        <div className="bubble deleted">Nachricht gelöscht</div>
      </div>
    );
  }
  const emojiOnly = m.kind === "text" && isEmojiOnly(m.body);
  const ratio = m.media?.width && m.media?.height ? m.media.height / m.media.width : 0.75;

  return (
    <div className={`msg ${mine ? "mine" : "theirs"}`} data-id={m.id}>
      {showAuthor && !mine && <div className="msg-author">{authorName}</div>}
      <div
        className={`bubble ${emojiOnly ? "emoji-only" : ""} ${m.kind !== "text" ? `kind-${m.kind}` : ""} ${m.pending ? `pending-${m.pending}` : ""}`}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenu(true);
        }}
      >
        {m.replyTo && (
          <button type="button" className="reply-quote" onClick={() => actions.jumpTo(m.replyTo!.id)}>
            {m.replyTo.preview || "…"}
          </button>
        )}
        {m.kind === "image" && m.media && (
          <button type="button" className="msg-image" style={{ aspectRatio: `${1 / ratio}` }} onClick={() => actions.openImage(mediaSrc(m))}>
            <img src={mediaSrc(m)} alt={m.body || "Bild"} loading="lazy" decoding="async" width={m.media.width} height={m.media.height} />
          </button>
        )}
        {m.kind === "voice" && m.media && <VoicePlayer src={mediaSrc(m)} durationMs={m.media.durationMs} />}
        {m.body && <div className="msg-text">{linkify(m.body)}</div>}
        {m.correction && (
          <div className="msg-correction">
            <span className="small muted icon-line"><IconEdit size={13} aria-hidden /> Korrektur{correctorName ? ` von ${correctorName}` : ""}:</span>
            <div>
              <DiffText before={m.body} after={m.correction.body} />
            </div>
          </div>
        )}
        <div className="msg-meta">
          {m.editedAt && <span>bearbeitet · </span>}
          <span>{time(m.createdAt)}</span>
          {mine && (
            <span className="ticks" aria-label={m.pending === "sending" ? "wird gesendet" : m.pending === "failed" ? "nicht gesendet" : read ? "gelesen" : "gesendet"}>
              {m.pending === "sending" ? <IconClock size={13} /> : m.pending === "failed" ? <IconAlert size={13} /> : read ? <IconCheckCheck size={14} /> : <IconCheck size={14} />}
            </span>
          )}
        </div>
        <button type="button" className="msg-more" aria-label="Aktionen" onClick={() => setMenu((v) => !v)}>
          <IconMore size={16} />
        </button>
      </div>
      {m.pending === "failed" && (
        <button type="button" className="link small danger" onClick={() => actions.retry(m)}>
          Nicht gesendet – erneut versuchen
        </button>
      )}
      {m.reactions.length > 0 && (
        <div className="reactions">
          {m.reactions.map((r) => (
            <button key={r.emoji} type="button" className={`reaction ${r.mine ? "mine" : ""}`} onClick={() => actions.react(m, r.emoji)} aria-pressed={r.mine}>
              {r.emoji} {r.count > 1 ? r.count : ""}
            </button>
          ))}
        </div>
      )}
      {menu && m.id > 0 && (
        <div className="msg-menu" role="menu" onMouseLeave={() => setMenu(false)}>
          <div className="quick-reactions">
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => {
                  actions.react(m, e);
                  setMenu(false);
                }}
                aria-label={`Mit ${e} reagieren`}
              >
                {e}
              </button>
            ))}
          </div>
          <MenuItem label="Antworten" onClick={() => (actions.reply(m), setMenu(false))} />
          {m.kind === "text" && <MenuItem label="Kopieren" onClick={() => (void navigator.clipboard?.writeText(m.body), setMenu(false))} />}
          {m.kind === "text" && <MenuItem label="Wörter lernen" onClick={() => (actions.learn(m), setMenu(false))} />}
          {!mine && m.kind === "text" && <MenuItem label="Korrigieren" onClick={() => (actions.correct(m), setMenu(false))} />}
          {mine && m.kind === "text" && <MenuItem label="Bearbeiten" onClick={() => (actions.edit(m), setMenu(false))} />}
          {mine && <MenuItem label="Löschen" danger onClick={() => (actions.remove(m), setMenu(false))} />}
          <MenuItem label="Schließen" onClick={() => setMenu(false)} />
        </div>
      )}
    </div>
  );
});

function MenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" role="menuitem" className={`menu-item ${danger ? "danger" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}
