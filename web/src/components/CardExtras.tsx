import { useLiveQuery } from "@tanstack/react-db";
import { Link } from "react-router-dom";
import { wordRefKey, type LangCode } from "@vochat/shared";
import { useSession } from "../session";
import type { CardRow, NoteRow } from "../local/collections";
import { Lemma } from "./ui";
import { IconNotes } from "./icons";

/** Notizen, die auf diese Karte verweisen – über die ID oder Sprache + Wortschlüssel. */
export function useNotesFor(card: Pick<CardRow, "id" | "lang" | "lemma">): NoteRow[] {
  const { collections } = useSession();
  const notes = (useLiveQuery(() => collections.notes).data ?? []) as NoteRow[];
  const key = wordRefKey(card.lang, card.lemma);
  return notes.filter((n) => !n.deleted && n.links.some((l) => l.type === "card" && (l.id === card.id || l.key === key)));
}

/**
 * Persönliche Zusatzangaben einer Karte: weitere Übersetzungen, eigene Beispielsätze, Notiz
 * und verlinkte Notizen. Zeigt nichts an, wenn nichts vorhanden ist.
 */
export function CardExtras({ card, showNote = true }: { card: CardRow; showNote?: boolean }) {
  const notes = useNotesFor(card);
  const glosses = card.glosses ?? [];
  const examples = card.examples ?? [];
  const note = showNote ? card.note.trim() : "";
  if (!glosses.length && !examples.length && !note && !notes.length) return null;
  return (
    <div className="card-extras stack small">
      {glosses.length > 0 && (
        <div className="chips" aria-label="Weitere Übersetzungen">
          {glosses.map((g) => (
            <span key={g} className="chip">{g}</span>
          ))}
        </div>
      )}
      {examples.length > 0 && (
        <ul className="examples">
          {examples.map((e, i) => (
            <li key={i}>
              <Lemma lang={card.lang as LangCode}>{e.text}</Lemma>
              {e.translation && <div className="muted small">{e.translation}</div>}
            </li>
          ))}
        </ul>
      )}
      {note && <div className="card-note">{note}</div>}
      {notes.length > 0 && (
        <div className="row">
          <IconNotes size={15} aria-hidden />
          {notes.map((n) => (
            <Link key={n.id} to={`/notes/${n.id}`} className="badge">{n.title || "Ohne Titel"}</Link>
          ))}
        </div>
      )}
    </div>
  );
}
