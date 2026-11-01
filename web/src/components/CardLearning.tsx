import { useLiveQuery } from "@tanstack/react-db";
import { DAY_MS, importance, replay, retrievability, type Grade } from "@vochat/shared";
import { useSession } from "../session";
import type { CardRow, ReviewRow } from "../local/collections";
import { markKnown, resetProgress, setIgnored, setPinned, setRetention } from "../lib/cards";
import { Recordings } from "./Recordings";
import { formatDays, historyOf, plannerSettings, toPlannerCard, useLearningSettings } from "../lib/learning";
import { IconPin } from "./icons";

const GRADE_LABEL: Record<Grade, string> = { again: "falsch", hard: "schwer", good: "gut", easy: "leicht" };
const QUALITY_LABEL = {
  start: "erstes Lernen",
  strong: "starker Zuwachs",
  solid: "Zuwachs",
  weak: "kaum Zuwachs (zu kurz nach der letzten Antwort)",
  lapse: "vergessen",
} as const;
const pct = (x: number) => `${Math.round(x * 100)} %`;
const date = (t: number) => new Date(t).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });

/**
 * Lernverlauf einer Karte – macht das Gedächtnismodell nachvollziehbar – plus eigene Entscheidungen
 * (kenne ich, ignorieren, vorziehen, öfter/seltener, zurücksetzen).
 */
export function CardLearning({ card }: { card: CardRow }) {
  const { collections } = useSession();
  const settings = useLearningSettings();
  const reviews = (useLiveQuery(() => collections.reviews).data ?? []) as ReviewRow[];
  const mine = reviews.filter((r) => r.cardId === card.id && !r.deleted).sort((a, b) => a.at - b.at);
  const history = historyOf(card, reviews);
  const r = replay(history);
  const now = Date.now();
  const target = card.retention ?? settings.retention;
  const recall = r.state && r.lastReviewAt !== null ? retrievability((now - r.lastReviewAt) / DAY_MS, r.state.stability) : null;
  const imp = importance(toPlannerCard(card), plannerSettings(settings));
  const manualAt = new Set(mine.filter((x) => x.mode === "manual").map((x) => x.at));
  const ignoredBefore = mine.length - history.length;

  return (
    <section className="card-learning stack">
      {card.lexemeId && <Recordings lexemeId={card.lexemeId} lemma={card.lemma} />}
      <b>Lernstand</b>
      {card.ignored && <div className="warn-box small">Ignoriert – wird nicht abgefragt.</div>}
      {!r.state ? (
        <div className="small">
          Noch nicht gelernt. Priorität für neue Wörter: {imp.reasons.length ? imp.reasons.join(" · ") : "Standard"}.
        </div>
      ) : (
        <div className="learn-facts small">
          <span>
            Erinnerung jetzt <b>{pct(recall!)}</b>
          </span>
          <span>
            Stabilität <b>{formatDays(r.state.stability)}</b>
            <span className="muted"> (nach dieser Zeit sitzt es noch zu 90 %)</span>
          </span>
          <span>
            Schwierigkeit <b>{r.state.difficulty.toFixed(1).replace(".", ",")}</b>/10
          </span>
          <span>
            Nächste Wiederholung{" "}
            <b>{card.dueAt <= now ? "jetzt fällig" : `in ${formatDays((card.dueAt - now) / DAY_MS)} (${date(card.dueAt)})`}</b>
            <span className="muted"> – dann liegt die Erinnerung bei etwa {pct(target)}</span>
          </span>
          <span>
            {r.reps} Antworten · {r.lapses}× vergessen
          </span>
        </div>
      )}

      {r.steps.length > 0 && (
        <details>
          <summary className="small">Verlauf ({r.steps.length})</summary>
          <div className="table-scroll">
            <table className="history-table small">
              <thead>
                <tr><th>Wann</th><th>Pause</th><th>Erinnerung vorher</th><th>Antwort</th><th>Wirkung</th></tr>
              </thead>
              <tbody>
                {r.steps.map((s) => (
                  <tr key={s.at} className={`q-${s.quality}`}>
                    <td>{date(s.at)}</td>
                    <td>{s.elapsedDays === null ? "–" : formatDays(s.elapsedDays)}</td>
                    <td>{s.recall === null ? "–" : pct(s.recall)}</td>
                    <td>{manualAt.has(s.at) ? "„kenne ich“" : GRADE_LABEL[s.grade]}</td>
                    <td>
                      {s.stabilityBefore === null ? formatDays(s.stabilityAfter) : `${formatDays(s.stabilityBefore)} → ${formatDays(s.stabilityAfter)}`}
                      {s.gain !== null && ` (×${s.gain.toFixed(2).replace(".", ",")})`} · {QUALITY_LABEL[s.quality]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {ignoredBefore > 0 && <div className="muted small">{ignoredBefore} Antworten vor dem Zurücksetzen zählen nicht mehr.</div>}
          <div className="muted small">
            Je länger die Pause (und je niedriger die Erinnerung vorher), desto mehr bringt eine richtige Antwort.
          </div>
        </details>
      )}

      <div className="row wrap">
        {!card.ignored ? (
          <button className="small-btn" onClick={() => setIgnored(collections, card, true)}>Ignorieren</button>
        ) : (
          <button className="small-btn" onClick={() => setIgnored(collections, card, false)}>Wieder lernen</button>
        )}
        <button className="small-btn" onClick={() => markKnown(collections, card)}>Kenne ich schon</button>
        <button className="small-btn" aria-pressed={!!card.pinned} onClick={() => setPinned(collections, card, !card.pinned)}>
          <IconPin size={14} aria-hidden /> {card.pinned ? "vorgezogen" : "Als Nächstes lernen"}
        </button>
        <label className="inline small">
          Wiederholen
          <select
            value={card.retention == null ? "" : String(card.retention)}
            onChange={(e) => setRetention(collections, card, e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">normal ({pct(settings.retention)})</option>
            <option value="0.95">öfter (95 %)</option>
            <option value="0.8">seltener (80 %)</option>
          </select>
        </label>
        {r.reps > 0 && (
          <button
            className="small-btn danger"
            onClick={() => {
              if (window.confirm("Lernstand zurücksetzen? Der Verlauf bleibt sichtbar, zählt aber nicht mehr.")) resetProgress(collections, card);
            }}
          >
            Zurücksetzen
          </button>
        )}
      </div>
    </section>
  );
}
