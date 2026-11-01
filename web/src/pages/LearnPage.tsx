import { useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { isDue, reviewCard, type Grade, type LangCode } from "@vochat/shared";
import { useSession } from "../session";
import { useActiveLang } from "../lib/lang";
import type { CardRow } from "../local/collections";
import { CefrBadge, Empty, Lemma } from "../components/ui";

const GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: "again", label: "Nochmal", hint: "< 10 Min" },
  { grade: "hard", label: "Schwer", hint: "kurz" },
  { grade: "good", label: "Gut", hint: "normal" },
  { grade: "easy", label: "Leicht", hint: "länger" },
];

/** Lernsitzung: fällige Karten, aufdecken, bewerten. Der Zeitplan rechnet lokal (offline-fähig). */
export function LearnPage() {
  const { collections } = useSession();
  const [lang] = useActiveLang();
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);

  const due = useMemo(() => {
    const now = Date.now();
    return cards
      .filter((c) => !c.deleted && c.lang === lang && isDue(c, now))
      .sort((a, b) => a.dueAt - b.dueAt);
  }, [cards, lang, done]);

  const current = due[0];

  const answer = (grade: Grade) => {
    if (!current) return;
    const now = Date.now();
    const next = reviewCard(current, grade, now);
    collections.cards.update(current.id, (draft) => {
      Object.assign(draft, next, { updatedAt: now });
    });
    setRevealed(false);
    setDone((n) => n + 1);
  };

  if (!current) {
    return (
      <div className="card center-card">
        <h2>{done > 0 ? "Alles erledigt 🎉" : "Gerade nichts fällig"}</h2>
        <p className="muted">{done > 0 ? `${done} Karten in dieser Sitzung.` : "Schau später wieder vorbei oder füge im Chat neue Wörter hinzu."}</p>
      </div>
    );
  }

  return (
    <div className="learn">
      <div className="muted small">Noch {due.length} fällig · heute erledigt: {done}</div>
      <div className="card flashcard">
        <Lemma lang={current.lang as LangCode}>
          <span className="big">{current.lemma}</span>
        </Lemma>
        <div className="row center-row">
          <CefrBadge level={current.cefr} />
          <span className="muted small">{current.lapses > 0 ? `${current.lapses}× vergessen` : `${current.reps} Wiederholungen`}</span>
        </div>
        {!revealed ? (
          <button className="primary wide" onClick={() => setRevealed(true)}>Bedeutung zeigen</button>
        ) : (
          <>
            <div className="answer">{current.gloss ?? <span className="muted">(keine Bedeutung gespeichert)</span>}</div>
            {current.note && <div className="muted small">{current.note}</div>}
            <div className="grades">
              {GRADES.map((g) => (
                <button key={g.grade} className={`grade grade-${g.grade}`} onClick={() => answer(g.grade)}>
                  <span>{g.label}</span>
                  <small>{g.hint}</small>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {due.length === 0 && <Empty>Keine fälligen Karten.</Empty>}
    </div>
  );
}
