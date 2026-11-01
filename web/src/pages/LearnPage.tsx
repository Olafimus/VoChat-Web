import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import {
  buildSmartPack,
  isDue,
  judgeAnswer,
  splitAnswers,
  type Grade,
  type Judgement,
  type LangCode,
  type Mode,
  type PackReason,
} from "@vochat/shared";
import { useSession } from "../session";
import { useActiveLang } from "../lib/lang";
import { recordAnswer } from "../lib/cards";
import type { CardRow, ReviewRow } from "../local/collections";
import { CefrBadge, Empty } from "../components/ui";
import { WordView } from "../components/WordView";

const FORMATS: { mode: Mode; label: string; hint: string }[] = [
  { mode: "flip", label: "Karteikarte", hint: "Wort sehen, Bedeutung aufdecken" },
  { mode: "reverse", label: "Umdrehen", hint: "Bedeutung sehen, Wort aufdecken" },
  { mode: "type", label: "Tippen", hint: "Bedeutung sehen, Wort eintippen" },
];

const GRADES: { grade: Grade; label: string; hint: string }[] = [
  { grade: "again", label: "Nochmal", hint: "falsch" },
  { grade: "hard", label: "Schwer", hint: "richtig, mühsam" },
  { grade: "good", label: "Gut", hint: "richtig" },
  { grade: "easy", label: "Leicht", hint: "sehr sicher" },
];

const REASON_LABEL: Record<PackReason, string> = {
  schwach: "schwach",
  wiederholen: "wiederholen",
  fällig: "fällig",
  neu: "neu",
};

/** Lernseite: drei Formate, fällige Karten oder ein Lernpaket aus Schwächen und Wiederholungen. */
export function LearnPage() {
  const { collections } = useSession();
  const [lang] = useActiveLang();
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];
  const reviews = (useLiveQuery((q) => collections.reviews).data ?? []) as ReviewRow[];

  const [format, setFormat] = useState<Mode>("flip");
  const [packMode, setPackMode] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [reasons, setReasons] = useState<Record<string, PackReason>>({});
  const [revealed, setRevealed] = useState(false);
  const [typed, setTyped] = useState("");
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [total, setTotal] = useState(0);
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  const langCards = useMemo(() => cards.filter((c) => !c.deleted && c.lang === lang), [cards, lang]);

  // Warteschlange nur bei Wechsel von Sprache, Format oder Modus neu aufbauen (nicht bei jeder Änderung).
  useEffect(() => {
    const now = Date.now();
    if (packMode) {
      const items = buildSmartPack(langCards, reviews.map(toEvent), { now, size: 15 });
      setQueue(items.map((i) => i.cardId));
      setReasons(Object.fromEntries(items.map((i) => [i.cardId, i.reason])));
    } else {
      const due = langCards.filter((c) => isDue(c, now)).sort((a, b) => a.dueAt - b.dueAt);
      setQueue(due.map((c) => c.id));
      setReasons({});
    }
    setScore({ right: 0, wrong: 0 });
    setStreak(0);
    setBestStreak(0);
    setFeedback(null);
    setRevealed(false);
    setTyped("");
    setJudgement(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, packMode, format, sessionKey]);

  useEffect(() => {
    setTotal((t) => Math.max(t, queue.length + score.right + score.wrong));
  }, [queue.length, score.right, score.wrong]);

  const current = queue.map((id) => langCards.find((c) => c.id === id)).find(Boolean) as CardRow | undefined;

  const resetCard = () => {
    setRevealed(false);
    setTyped("");
    setJudgement(null);
  };

  const finish = (grade: Grade, typedValue: string | null) => {
    if (!current) return;
    recordAnswer(collections, current, { mode: format, grade, typed: typedValue });
    const wrong = grade === "again";
    setScore((s) => ({ right: s.right + (wrong ? 0 : 1), wrong: s.wrong + (wrong ? 1 : 0) }));
    setStreak((n) => {
      const next = wrong ? 0 : n + 1;
      setBestStreak((b) => Math.max(b, next));
      return next;
    });
    setFeedback(wrong ? "wrong" : "right");
    setQueue((q) => {
      const rest = q.slice(1);
      if (!wrong) return rest;
      // Falsche Karte kommt nach ein paar anderen Karten noch einmal dran.
      const at = Math.min(3, rest.length);
      return [...rest.slice(0, at), current.id, ...rest.slice(at)];
    });
    resetCard();
  };

  const submitTyped = () => {
    if (!current || judgement) return;
    const accepted = [current.lemma];
    const result = judgeAnswer(accepted, typed);
    setJudgement(result);
    setRevealed(true);
    if (result.verdict === "correct") finish("good", typed);
    // Tippfehler: Korrektur zeigen, Nutzer bestätigt mit "Weiter" (wird als richtig gewertet)
  };

  const continueAfterTypo = () => {
    if (!current || !judgement) return;
    finish(judgement.verdict === "typo" ? "good" : "again", typed);
  };

  if (langCards.length === 0) {
    return <Empty>Noch keine Karten für diese Sprache. Füge im Chat oder unter „Lernpfade“ Wörter hinzu.</Empty>;
  }

  return (
    <div className="learn">
      <div className="learn-controls">
        <div className="segmented three">
          {FORMATS.map((f) => (
            <button key={f.mode} className={format === f.mode ? "on" : ""} onClick={() => setFormat(f.mode)} title={f.hint}>
              {f.label}
            </button>
          ))}
        </div>
        <label className="inline">
          <input type="checkbox" checked={packMode} onChange={(e) => setPackMode(e.target.checked)} /> Lernpaket (15)
        </label>
      </div>

      <div className="pack-stats" aria-live="polite">
        <div className="pack-bar" aria-label={`${total - queue.length} von ${total} erledigt`}>
          <span style={{ width: `${total ? Math.round(((total - queue.length) / total) * 100) : 0}%` }} />
        </div>
        <div className="pack-numbers">
          <span>noch <b>{queue.length}</b> von {total}</span>
          <span>
            {score.right + score.wrong > 0 ? `${Math.round((score.right / (score.right + score.wrong)) * 100)} % richtig` : "– % richtig"}
          </span>
          <span key={streak} className={`streak ${streak >= 3 ? "hot" : ""} ${streak > 0 ? "pop" : ""}`}>
            🔥 {streak} <span className="muted small">(Serie {bestStreak})</span>
          </span>
        </div>
      </div>

      {!current ? (
        <div className="card center-card celebrate">
          {score.right + score.wrong > 0 && <Confetti />}
          <h2>{score.right + score.wrong > 0 ? "Fertig 🎉" : packMode ? "Kein Paket nötig" : "Gerade nichts fällig"}</h2>
          <p className="muted">
            {score.right + score.wrong > 0
              ? `${score.right} richtig · ${score.wrong} falsch · beste Serie ${bestStreak} · ${Math.round((score.right / (score.right + score.wrong)) * 100)} % richtig.`
              : packMode
                ? "Du hast alles im Griff. Probier ein anderes Format oder füge neue Wörter hinzu."
                : "Schau später wieder vorbei oder aktiviere das Lernpaket."}
          </p>
          <div className="row center-row">
            <button className="primary" onClick={() => setSessionKey((k) => k + 1)}>Nochmal starten</button>
          </div>
        </div>
      ) : (
        <div className={`flip-scene ${feedback ? `fb-${feedback}` : ""}`} key={`${current.id}-${queue.length}`} onAnimationEnd={() => setFeedback(null)}>
        <div className="card flashcard">
          <div className="row center-row">
            {packMode && reasons[current.id] && <span className="badge subtle">{REASON_LABEL[reasons[current.id]]}</span>}
            <span className="muted small">noch {queue.length} · ✓ {score.right} · ✗ {score.wrong}</span>
          </div>

          {format === "flip" && <PromptWord card={current} />}
          {format === "reverse" && <PromptMeaning card={current} />}

          {format !== "type" && (
            <>
              {!revealed ? (
                <button className="primary wide" onClick={() => setRevealed(true)}>
                  {format === "flip" ? "Bedeutung zeigen" : "Wort zeigen"}
                </button>
              ) : (
                <>
                  <div className="answer reveal" key="answer">
                    {format === "flip" ? (
                      current.gloss ?? <span className="muted">(keine Bedeutung gespeichert)</span>
                    ) : (
                      <WordView lemma={current.lemma} lang={current.lang as LangCode} pronunciation={current.pronunciation} large />
                    )}
                  </div>
                  <div className="grades">
                    {GRADES.map((g) => (
                      <button key={g.grade} className={`grade grade-${g.grade}`} onClick={() => finish(g.grade, null)}>
                        <span>{g.label}</span>
                        <small>{g.hint}</small>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {format === "type" && (
            <form
              className="typing"
              onSubmit={(e) => {
                e.preventDefault();
                if (judgement) continueAfterTypo();
                else submitTyped();
              }}
            >
              <div className="answer">{current.gloss ?? <span className="muted">(keine Bedeutung)</span>}</div>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Wort eintippen …"
                aria-label="Antwort"
                autoFocus
                disabled={judgement !== null}
                dir={current.lang === "fa" ? "rtl" : "ltr"}
                lang={current.lang}
              />
              {judgement && (
                <div className={`verdict verdict-${judgement.verdict}`} role="status">
                  {judgement.verdict !== "wrong" && <WordView lemma={current.lemma} lang={current.lang as LangCode} pronunciation={current.pronunciation} />}
                  {judgement.verdict === "typo"
                    ? `Fast – richtig ist „${judgement.expected}“ (ein Tippfehler ist erlaubt).`
                    : judgement.verdict === "correct"
                      ? "Richtig!"
                      : `Leider falsch. Richtig wäre „${current.lemma}“.`}
                </div>
              )}
              {!judgement ? (
                <button className="primary wide" type="submit" disabled={!typed.trim()}>Prüfen</button>
              ) : (
                <button className="primary wide" type="submit">Weiter</button>
              )}
            </form>
          )}
          <CefrBadge level={current.cefr} />
        </div>
        </div>
      )}
    </div>
  );
}

/** Kleine Konfetti-Explosion am Ende einer Runde. Entfällt bei reduzierter Bewegung (CSS). */
function Confetti() {
  const pieces = Array.from({ length: 36 }, (_, i) => i);
  return (
    <div className="confetti" aria-hidden>
      {pieces.map((i) => (
        <span
          key={i}
          style={{
            left: `${(i * 37) % 100}%`,
            animationDelay: `${(i % 9) * 0.05}s`,
            background: ["#f59e0b", "#4f46e5", "#16a34a", "#e11d48", "#0ea5e9"][i % 5],
            transform: `rotate(${(i * 53) % 360}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function PromptWord({ card }: { card: CardRow }) {
  return <WordView lemma={card.lemma} lang={card.lang as LangCode} pronunciation={card.pronunciation} large />;
}

function PromptMeaning({ card }: { card: CardRow }) {
  return <div className="answer">{card.gloss ? splitAnswers(card.gloss).join(" · ") : <span className="muted">(keine Bedeutung)</span>}</div>;
}

function toEvent(r: ReviewRow) {
  return { cardId: r.cardId, outcome: r.outcome, mode: r.mode, at: r.at };
}
