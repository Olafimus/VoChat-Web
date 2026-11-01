import { useEffect, useState } from "react";
import { isSubstantialChange } from "@vochat/shared";
import { review, type HistoryEntry } from "../api/client";
import { useSession } from "../session";
import type { CardRow } from "../local/collections";
import { acceptUpdate, ignoreUpdate } from "../lib/cards";
import { updateSignature } from "../lib/linker";
import { DiffText } from "./DiffText";
import { WordView } from "./WordView";
import { IconEdit } from "./icons";

const FIELD_LABEL = { gloss: "Bedeutung", pronunciation: "Aussprache", cefr: "Niveau" } as const;
const ACTION_LABEL: Record<string, string> = {
  "sense.edit": "hat die Bedeutung korrigiert",
  "sense.hide": "hat eine Bedeutung entfernt",
  "sense.add": "hat eine Bedeutung ergänzt",
  "translation.add": "hat eine Übersetzung ergänzt",
  "translation.hide": "hat eine Übersetzung entfernt",
  "pronunciation.set": "hat die Aussprache gesetzt",
  "contribution.verified": "Community-Vorschlag verifiziert",
  "review.approve": "hat den Eintrag geprüft",
};

/** Liste vorgeschlagener Korrekturen für Wörter der eigenen Sammlung – mit Diff und Entscheidung je Wort. */
export function CardUpdates({ cards }: { cards: CardRow[] }) {
  const pending = cards.filter((c) => !c.deleted && c.pendingUpdate && Object.keys(c.pendingUpdate.fields).length > 0);
  const { collections } = useSession();
  if (pending.length === 0) return null;
  return (
    <section className="card stack updates" aria-label="Korrekturen">
      <div className="row">
        <h3 style={{ margin: 0 }} className="icon-title"><IconEdit size={18} aria-hidden /> Korrekturen für deine Wörter ({pending.length})</h3>
        <span className="spacer" />
        {pending.length > 1 && (
          <button className="small-btn" onClick={() => pending.forEach((c) => acceptUpdate(collections, c, { resetLearning: false }))}>
            Alle übernehmen (Lernstand behalten)
          </button>
        )}
      </div>
      <p className="muted small">
        Das Wörterbuch wurde geändert. Du entscheidest je Wort, ob du die Korrektur übernimmst – und ob dein bisheriger Lernstand bleibt.
      </p>
      <ul className="list">
        {pending.map((c) => (
          <UpdateItem key={c.id} card={c} />
        ))}
      </ul>
    </section>
  );
}

function UpdateItem({ card }: { card: CardRow }) {
  const { collections } = useSession();
  const fields = card.pendingUpdate!.fields;
  const meaningChanged = !!fields.gloss && isSubstantialChange(fields.gloss.from, fields.gloss.to);
  const [reset, setReset] = useState(meaningChanged && card.reps > 0);
  const [why, setWhy] = useState<HistoryEntry | null>(null);
  useEffect(() => {
    if (!card.lexemeId) return;
    review
      .history(card.lexemeId)
      .then((h) => setWhy(h.find((e) => e.action in ACTION_LABEL && e.action !== "review.approve") ?? h[0] ?? null))
      .catch(() => setWhy(null));
  }, [card.lexemeId]);

  return (
    <li className="update-item stack">
      <WordView lexemeId={card.lexemeId} lemma={card.lemma} lang={card.lang as never} pronunciation={card.pronunciation} />
      {(Object.keys(fields) as (keyof typeof fields)[]).map((f) => (
        <div key={f} className="small">
          <span className="muted">{FIELD_LABEL[f]}: </span>
          <DiffText before={fields[f]!.from ?? ""} after={fields[f]!.to ?? ""} />
        </div>
      ))}
      {why && (
        <div className="muted small">
          {why.actor?.name ?? "Wörterbuch"} {ACTION_LABEL[why.action] ?? why.action} · {new Date(why.at).toLocaleDateString("de-DE")}
        </div>
      )}
      {card.reps > 0 && (
        <label className="inline small">
          <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} />
          Lernstand zurücksetzen{meaningChanged ? " (empfohlen: die Bedeutung hat sich geändert)" : ""}
        </label>
      )}
      <div className="row">
        <button className="small-btn primary" onClick={() => acceptUpdate(collections, card, { resetLearning: reset })}>Übernehmen</button>
        <button className="small-btn" onClick={() => ignoreUpdate(collections, card, updateSignature(fields))}>Ignorieren</button>
      </div>
    </li>
  );
}
