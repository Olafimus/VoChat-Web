import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "@tanstack/react-db";
import {
  buildPlan,
  hasGlyphLearning,
  judgeAnswer,
  splitAnswers,
  type Grade,
  type Judgement,
  type LangCode,
  type Mode,
  type Cefr,
  type PlanItem,
} from "@vochat/shared";
import { useSession } from "../session";
import { useActiveLang } from "../lib/lang";
import { allGlosses, markKnown, recordAnswer, setIgnored } from "../lib/cards";
import { CardExtras } from "../components/CardExtras";
import { formatDays, plannerSettings, scheduleFor, startOfToday, toPlannerCard, useLearningSettings } from "../lib/learning";
import type { CardRow, ReviewRow } from "../local/collections";
import { CefrBadge, Empty } from "../components/ui";
import { WordView } from "../components/WordView";
import { useDisplay } from "../lib/display";
import { playPronunciation } from "../lib/audio";
import { IconFlame, IconLanguages, IconStats } from "../components/icons";
import { PageHeader } from "../components/PageHeader";
import { IconCards } from "../components/icons";

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

const KIND_LABEL: Record<PlanItem["kind"], string> = { relearn: "festigen", review: "wiederholen", new: "neu" };

/**
 * Lernseite: drei Formate. Was drankommt, entscheidet der Planer (Gedächtnismodell + Wichtigkeit);
 * jede Karte zeigt auf Wunsch, warum sie jetzt dran ist.
 */
export function LearnPage() {
  const { collections, user } = useSession();
  const settings = useLearningSettings();
  const [lang] = useActiveLang();
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];
  const reviews = (useLiveQuery((q) => collections.reviews).data ?? []) as ReviewRow[];

  const [format, setFormat] = useState<Mode>("flip");
  const [scope, setScope] = useState<"block" | "all">("block");
  const [queue, setQueue] = useState<string[]>([]);
  const [planInfo, setPlanInfo] = useState<Record<string, PlanItem>>({});
  const [planNotes, setPlanNotes] = useState<string[]>([]);
  const [showWhy, setShowWhy] = useState(false);
  const shownAt = useRef(Date.now());
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
    const ids = new Set(langCards.map((c) => c.id));
    const targetCefr = (user.learnLangs.find((l) => l.lang === lang)?.targetCefr ?? null) as Cefr | null;
    const activeOrigins = [...new Set(langCards.map((c) => c.origin).filter((o): o is string => !!o?.startsWith("challenge:")))];
    const plan = buildPlan(
      langCards.map(toPlannerCard),
      reviews.filter((r) => ids.has(r.cardId)),
      plannerSettings(settings, { targetCefr, activeOrigins }),
      now,
      startOfToday(now),
    );
    const items = scope === "block" ? plan.items.slice(0, settings.blockSize) : plan.items;
    setQueue(items.map((i) => i.cardId));
    setPlanInfo(Object.fromEntries(items.map((i) => [i.cardId, i])));
    setPlanNotes(plan.notes);
    setScore({ right: 0, wrong: 0 });
    setStreak(0);
    setBestStreak(0);
    setFeedback(null);
    setRevealed(false);
    setTyped("");
    setJudgement(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, scope, format, sessionKey]);

  useEffect(() => {
    setTotal((t) => Math.max(t, queue.length + score.right + score.wrong));
  }, [queue.length, score.right, score.wrong]);

  const current = queue.map((id) => langCards.find((c) => c.id === id)).find(Boolean) as CardRow | undefined;
  const display = useDisplay();
  // Vorlesen, sobald das Wort in der Zielsprache sichtbar wird.
  const targetVisible = !!current && (format === "flip" || (format === "reverse" && revealed) || (format === "type" && !!judgement));
  useEffect(() => {
    if (!display.autoplay || !targetVisible || !current) return;
    void playPronunciation({ lang: current.lang as LangCode, text: current.lemma, lexemeId: current.lexemeId, mode: display.voice });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [display.autoplay, targetVisible, current?.id, queue.length]);

  useEffect(() => {
    shownAt.current = Date.now();
    setShowWhy(false);
  }, [current?.id, queue.length]);

  const resetCard = () => {
    setRevealed(false);
    setTyped("");
    setJudgement(null);
  };

  const dropCurrent = () => {
    if (!current) return;
    setQueue((q) => q.filter((id) => id !== current.id));
    resetCard();
  };

  /** Vorschau: wann käme die Karte bei dieser Bewertung wieder? */
  const preview = (grade: Grade) => {
    if (!current) return "";
    const now = Date.now();
    const next = scheduleFor(current, reviews, settings, { at: now, grade });
    return formatDays((next.dueAt - now) / 86_400_000);
  };

  const finish = (grade: Grade, typedValue: string | null, responseMs = Date.now() - shownAt.current) => {
    if (!current) return;
    recordAnswer(collections, current, { mode: format, grade, typed: typedValue, responseMs });
    const wrong = grade === "again";
    setScore((s) => ({ right: s.right + (wrong ? 0 : 1), wrong: s.wrong + (wrong ? 1 : 0) }));
    setStreak((n) => {
      const next = wrong ? 0 : n + 1;
      setBestStreak((b) => Math.max(b, next));
      return next;
    });
    setFeedback(wrong ? "wrong" : "right");
    setQueue((q) => {
      // Genau die beantwortete Karte entfernen (nicht blind die erste ID – die kann inzwischen gelöscht sein).
      const at = q.indexOf(current.id);
      const rest = at >= 0 ? [...q.slice(0, at), ...q.slice(at + 1)] : q;
      if (!wrong) return rest;
      // Falsche Karte kommt nach ein paar anderen Karten noch einmal dran.
      const later = Math.min(3, rest.length);
      return [...rest.slice(0, later), current.id, ...rest.slice(later)];
    });
    resetCard();
  };

  const submitTyped = () => {
    if (!current || judgement) return;
    const accepted = [current.lemma];
    const result = judgeAnswer(accepted, typed);
    setJudgement(result);
    setRevealed(true);
    // Richtig, aber sehr langsam (> 20 s) zählt als „schwer“.
    const ms = Date.now() - shownAt.current;
    if (result.verdict === "correct") finish(ms > 20_000 ? "hard" : "good", typed, ms);
    // Tippfehler: Korrektur zeigen, Nutzer bestätigt mit "Weiter" (wird als richtig gewertet)
  };

  const continueAfterTypo = () => {
    if (!current || !judgement) return;
    // Tippfehler: richtig, aber unsicher → „schwer“ (kleinerer Zuwachs als „gut“).
    finish(judgement.verdict === "typo" ? "hard" : "again", typed);
  };

  const glyphLink = hasGlyphLearning(lang) && (
    <Link to="/glyphs" className="small icon-line"><IconLanguages size={15} aria-hidden /> Zeichen lernen (Kana & Kanji)</Link>
  );

  if (langCards.length === 0) {
    return (
      <>
        <Empty>Noch keine Karten für diese Sprache. Füge im Chat oder unter „Lernpfade“ Wörter hinzu.</Empty>
        {glyphLink && <p className="text-center">{glyphLink}</p>}
      </>
    );
  }

  return (
    <div className="learn">
      <PageHeader icon={<IconCards size={22} />} title="Lernen" subtitle="Der Planer wählt, was jetzt am meisten bringt" />
      <div className="learn-controls">
        <div className="segmented three">
          {FORMATS.map((f) => (
            <button key={f.mode} className={format === f.mode ? "on" : ""} onClick={() => setFormat(f.mode)} title={f.hint}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="segmented">
          <button className={scope === "block" ? "on" : ""} onClick={() => setScope("block")} title="Die wichtigsten Karten jetzt">
            Lernblock ({settings.blockSize})
          </button>
          <button className={scope === "all" ? "on" : ""} onClick={() => setScope("all")} title="Alles, was heute dran ist">
            Alles für heute
          </button>
        </div>
        <Link to="/stats" className="small icon-line"><IconStats size={15} aria-hidden /> Statistik & Einstellungen</Link>
        {glyphLink}
      </div>
      {planNotes.length > 0 && <div className="muted small" role="status">{planNotes.join(" ")}</div>}

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
            <IconFlame size={16} aria-hidden /> {streak} <span className="muted small">(Serie {bestStreak})</span>
          </span>
        </div>
      </div>

      {!current ? (
        <div className="card center-card celebrate">
          {score.right + score.wrong > 0 && <Confetti />}
          <h2>{score.right + score.wrong > 0 ? "Geschafft!" : "Gerade nichts dran"}</h2>
          <p className="muted">
            {score.right + score.wrong > 0
              ? `${score.right} richtig · ${score.wrong} falsch · beste Serie ${bestStreak} · ${Math.round((score.right / (score.right + score.wrong)) * 100)} % richtig.`
              : "Alle fälligen Wörter sitzen, und das Tageslimit für neue Wörter ist erreicht. Mehr dazu in der Statistik."}
          </p>
          <div className="row center-row">
            <button className="primary" onClick={() => setSessionKey((k) => k + 1)}>Nochmal starten</button>
          </div>
        </div>
      ) : (
        <div className={`flip-scene ${feedback ? `fb-${feedback}` : ""}`} key={`${current.id}-${queue.length}`} onAnimationEnd={() => setFeedback(null)}>
        <div className="card flashcard">
          <div className="row center-row">
            {planInfo[current.id] && (
              <button className="badge subtle why" onClick={() => setShowWhy((v) => !v)} aria-expanded={showWhy} title="Warum jetzt?">
                {KIND_LABEL[planInfo[current.id].kind]} · warum?
              </button>
            )}
            <span className="muted small">noch {queue.length} · {score.right} richtig · {score.wrong} falsch</span>
          </div>
          {showWhy && planInfo[current.id] && (
            <ul className="why-list small">
              {planInfo[current.id].reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
              {current.stability ? <li>Stabilität {formatDays(current.stability)} · Schwierigkeit {(current.difficulty ?? 5).toFixed(1)}/10</li> : null}
              <li className="row">
                <button className="link small" onClick={() => { markKnown(collections, current); dropCurrent(); }}>Kenne ich schon</button>
                <button className="link small danger" onClick={() => { setIgnored(collections, current, true); dropCurrent(); }}>Ignorieren</button>
              </li>
            </ul>
          )}

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
                      allGlosses(current).join(" · ") || <span className="muted">(keine Bedeutung gespeichert)</span>
                    ) : (
                      <WordView lexemeId={current.lexemeId} lemma={current.lemma} lang={current.lang as LangCode} pronunciation={current.pronunciation} large />
                    )}
                  </div>
                  <CardExtras card={current} />
                  <div className="grades">
                    {GRADES.map((g) => (
                      <button key={g.grade} className={`grade grade-${g.grade}`} onClick={() => finish(g.grade, null)}>
                        <span>{g.label}</span>
                        <small>{preview(g.grade)}</small>
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
              <div className="answer">{allGlosses(current).join(" · ") || <span className="muted">(keine Bedeutung)</span>}</div>
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
                  {judgement.verdict !== "wrong" && <WordView lexemeId={current.lexemeId} lemma={current.lemma} lang={current.lang as LangCode} pronunciation={current.pronunciation} />}
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
  return <WordView lexemeId={card.lexemeId} lemma={card.lemma} lang={card.lang as LangCode} pronunciation={card.pronunciation} large />;
}

function PromptMeaning({ card }: { card: CardRow }) {
  const all = allGlosses(card).flatMap(splitAnswers);
  return <div className="answer">{all.length ? [...new Set(all)].join(" · ") : <span className="muted">(keine Bedeutung)</span>}</div>;
}

