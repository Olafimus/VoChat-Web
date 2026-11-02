import { useEffect, useMemo, useRef, useState } from "react";
import { buildChoices, gradeAttempt, type Grade, type Strictness } from "@vochat/shared";
import { useSession } from "../../session";
import { formatKun, glyphAnswer, recordGlyphAnswer, recordTrace, useGlyphStrokes, type GlyphInfo } from "../../lib/glyphs";
import { StrokeBoard, type StrokeBoardHandle, type StrokeBoardSummary } from "./StrokeBoard";
import { GlyphAnimation } from "./GlyphAnimation";
import { IconBack, IconFlame, IconWhy } from "../icons";

export type GlyphMode = "recognize" | "trace" | "master";

export const MODE_INFO: Record<GlyphMode, { label: string; hint: string }> = {
  recognize: { label: "Erkennen", hint: "Zeichen sehen, Lesung bzw. Bedeutung wählen" },
  trace: { label: "Nachzeichnen", hint: "Mit Vorlage in der richtigen Strichreihenfolge schreiben" },
  master: { label: "Masterclass", hint: "Aus dem Gedächtnis schreiben – Strichreihenfolge und Richtung zählen" },
};

export interface SessionItem {
  glyph: GlyphInfo;
  kind: "relearn" | "review" | "new";
}

const GRADE_LABEL: Record<Grade, string> = { again: "Nochmal", hard: "Schwer", good: "Gut", easy: "Leicht" };
const KIND_LABEL: Record<SessionItem["kind"], string> = { relearn: "festigen", review: "wiederholen", new: "neu" };

/** Ein Lernblock mit Zeichen: Erkennen, Nachzeichnen oder Masterclass. */
export function GlyphSession({
  lang,
  mode,
  items,
  pool,
  strictness,
  onExit,
}: {
  lang: string;
  mode: GlyphMode;
  items: SessionItem[];
  pool: GlyphInfo[];
  strictness: Strictness;
  onExit: () => void;
}) {
  const { collections } = useSession();
  const [queue, setQueue] = useState(items);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [streak, setStreak] = useState(0);
  const requeued = useRef(new Map<string, number>());
  const total = useRef(items.length);
  const current = queue[0];

  const next = (grade: Grade | null) => {
    if (!current) return;
    const wrong = grade === "again";
    if (grade) {
      setScore((s) => ({ right: s.right + (wrong ? 0 : 1), wrong: s.wrong + (wrong ? 1 : 0) }));
      setStreak((n) => (wrong ? 0 : n + 1));
    }
    setQueue((q) => {
      const rest = q.slice(1);
      const times = requeued.current.get(current.glyph.c) ?? 0;
      if (!wrong || times >= 2) return rest;
      requeued.current.set(current.glyph.c, times + 1);
      total.current++;
      const at = Math.min(3, rest.length);
      return [...rest.slice(0, at), { ...current, kind: "relearn" }, ...rest.slice(at)];
    });
    setStep((s) => s + 1);
  };

  const doneCount = total.current - queue.length;
  return (
    <div className="glyph-session">
      <div className="row gs-top">
        <button className="small-btn" onClick={onExit}>
          <IconBack size={15} aria-hidden /> Übersicht
        </button>
        <span className="badge">{MODE_INFO[mode].label}</span>
        <span className="muted small grow">
          {doneCount}/{total.current}
          {score.right + score.wrong > 0 && <> · {Math.round((score.right / (score.right + score.wrong)) * 100)} % richtig</>}
        </span>
        <span className={`streak ${streak >= 3 ? "hot" : ""}`}>
          <IconFlame size={16} aria-hidden /> {streak}
        </span>
      </div>
      <div className="pack-bar" aria-hidden>
        <span style={{ width: `${total.current ? Math.round((doneCount / total.current) * 100) : 0}%` }} />
      </div>

      {!current ? (
        <div className="card center-card">
          <h2>{score.right + score.wrong > 0 || mode === "trace" ? "Geschafft!" : "Gerade nichts dran"}</h2>
          <p className="muted">
            {mode === "trace"
              ? `${total.current} Zeichen nachgezeichnet.`
              : score.right + score.wrong > 0
                ? `${score.right} richtig · ${score.wrong} falsch.`
                : "Alles Fällige sitzt. Wähle eine andere Kategorie oder erhöhe die Zahl neuer Zeichen."}
          </p>
          <button className="primary" onClick={onExit}>Zur Übersicht</button>
        </div>
      ) : mode === "recognize" ? (
        <RecognizeStep
          key={step}
          item={current}
          pool={pool}
          onDone={(grade) => {
            recordGlyphAnswer(collections, lang, current.glyph, "read", grade);
            next(grade);
          }}
        />
      ) : mode === "trace" ? (
        <TraceStep
          key={step}
          lang={lang}
          item={current}
          strictness={strictness}
          onDone={() => {
            recordTrace(collections, lang, current.glyph);
            next(null);
          }}
        />
      ) : (
        <MasterStep
          key={step}
          lang={lang}
          item={current}
          strictness={strictness}
          onDone={(grade, mistakes) => {
            recordGlyphAnswer(collections, lang, current.glyph, "write", grade, mistakes);
            next(grade);
          }}
        />
      )}
    </div>
  );
}

/** Lesung und Bedeutung eines Zeichens. */
export function GlyphFacts({ glyph, compact = false }: { glyph: GlyphInfo; compact?: boolean }) {
  if (glyph.script !== "kanji") {
    return (
      <div className="glyph-facts">
        <div className="gf-romaji">{glyph.romaji}</div>
        {!compact && <div className="muted small">{glyph.script === "hiragana" ? "Hiragana" : "Katakana"} · {glyph.strokes} Striche</div>}
      </div>
    );
  }
  return (
    <div className="glyph-facts">
      <div className="gf-meaning">{glyph.meanings?.join(", ") || "—"}</div>
      {!!glyph.on?.length && (
        <div className="gf-reading">
          <span className="muted small">On</span> <span lang="ja">{glyph.on.join("、")}</span>
        </div>
      )}
      {!!glyph.kun?.length && (
        <div className="gf-reading">
          <span className="muted small">Kun</span> <span lang="ja">{glyph.kun.map(formatKun).join("、")}</span>
        </div>
      )}
      {!compact && (
        <div className="muted small">
          {glyph.strokes} Striche{glyph.jlpt ? ` · JLPT N${glyph.jlpt}` : ""}
          {glyph.grade && glyph.grade <= 6 ? ` · ${glyph.grade}. Klasse` : glyph.grade === 8 ? " · Mittelstufe" : ""}
          {glyph.freq ? ` · Häufigkeit #${glyph.freq}` : ""}
        </div>
      )}
    </div>
  );
}

/** Aufgabe für das Schreiben: Kana → Romaji, Kanji → Bedeutung + Lesungen. */
function WritePrompt({ glyph }: { glyph: GlyphInfo }) {
  return (
    <div className="write-prompt">
      <span className="muted small">
        Schreibe {glyph.script === "kanji" ? "das Kanji für" : glyph.script === "hiragana" ? "das Hiragana" : "das Katakana"}
      </span>
      <GlyphFacts glyph={glyph} compact />
    </div>
  );
}

function RecognizeStep({ item, pool, onDone }: { item: SessionItem; pool: GlyphInfo[]; onDone: (grade: Grade) => void }) {
  const { glyph } = item;
  const shownAt = useRef(Date.now());
  const options = useMemo(() => buildChoices(glyph, pool.filter((g) => g.script === glyph.script), glyphAnswer, 4), [glyph, pool]);
  const correct = glyphAnswer(glyph);
  const [picked, setPicked] = useState<{ value: string; ms: number } | null>(null);
  const right = picked?.value === correct;
  const grade: Grade = !picked ? "again" : !right ? "again" : picked.ms > 9000 ? "hard" : picked.ms < 2500 ? "easy" : "good";

  useEffect(() => {
    if (!picked) return;
    const onKey = (e: KeyboardEvent) => e.key === "Enter" && onDone(grade);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={`card glyph-card ${picked ? (right ? "fb-right" : "fb-wrong") : ""}`}>
      <span className="badge subtle">{KIND_LABEL[item.kind]}</span>
      <div className="glyph-big" lang="ja">{glyph.c}</div>
      <div className="choice-grid">
        {options.map((o, i) => (
          <button
            key={o}
            className={`choice ${picked && o === correct ? "is-right" : ""} ${picked?.value === o && o !== correct ? "is-wrong" : ""}`}
            disabled={!!picked}
            onClick={() => setPicked({ value: o, ms: Date.now() - shownAt.current })}
          >
            <span className="choice-key muted small">{i + 1}</span> {o}
          </button>
        ))}
      </div>
      {picked && (
        <>
          <div className={`verdict verdict-${right ? "correct" : "wrong"}`} role="status">
            {right ? "Richtig!" : `Richtig wäre „${correct}“.`}
          </div>
          <GlyphFacts glyph={glyph} />
          <button className="primary wide" onClick={() => onDone(grade)} autoFocus>Weiter</button>
        </>
      )}
      <KeyChoices enabled={!picked} count={options.length} onPick={(i) => setPicked({ value: options[i]!, ms: Date.now() - shownAt.current })} />
    </div>
  );
}

/** Ziffern 1–4 wählen eine Antwort. */
function KeyChoices({ enabled, count, onPick }: { enabled: boolean; count: number; onPick: (i: number) => void }) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= count) onPick(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return null;
}

function TraceStep({ lang, item, strictness, onDone }: { lang: string; item: SessionItem; strictness: Strictness; onDone: () => void }) {
  const strokes = useGlyphStrokes(lang, item.glyph);
  const [result, setResult] = useState<StrokeBoardSummary | null>(null);
  const [round, setRound] = useState(0);
  if (!strokes) return <div className="card center-card muted">Lade Strichdaten …</div>;
  return (
    <div className="card glyph-card">
      <div className="row center-row">
        <span className="badge subtle">{KIND_LABEL[item.kind]}</span>
      </div>
      <GlyphFacts glyph={item.glyph} compact />
      <div className="board-pair">
        <StrokeBoard
          key={round}
          strokes={strokes}
          mode="trace"
          strictness={strictness}
          autoHintAfter={1}
          label={`Nachzeichnen: ${item.glyph.c}`}
          onComplete={setResult}
        />
      </div>
      {result ? (
        <>
          <AttemptLine summary={result} />
          <div className="row center-row">
            <button onClick={() => { setResult(null); setRound((r) => r + 1); }}>Nochmal</button>
            <button className="primary" onClick={onDone} autoFocus>Weiter</button>
          </div>
        </>
      ) : (
        <p className="muted small text-center">Folge der Vorlage – der Punkt zeigt, wo der nächste Strich beginnt.</p>
      )}
    </div>
  );
}

function MasterStep({
  lang,
  item,
  strictness,
  onDone,
}: {
  lang: string;
  item: SessionItem;
  strictness: Strictness;
  onDone: (grade: Grade, mistakes: number) => void;
}) {
  const strokes = useGlyphStrokes(lang, item.glyph);
  // Neue Zeichen: erst ansehen und nachzeichnen, dann aus dem Gedächtnis.
  const [phase, setPhase] = useState<"intro" | "recall" | "result">(item.kind === "new" ? "intro" : "recall");
  const [result, setResult] = useState<{ summary: StrokeBoardSummary; grade: Grade } | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const board = useRef<StrokeBoardHandle>(null);

  if (!strokes) return <div className="card center-card muted">Lade Strichdaten …</div>;

  if (phase === "intro") {
    return (
      <div className="card glyph-card">
        <div className="row center-row">
          <span className="badge">neu</span>
          <span className="muted small">Sieh dir die Strichreihenfolge an und zeichne einmal nach.</span>
        </div>
        <GlyphFacts glyph={item.glyph} />
        <div className="board-pair">
          <GlyphAnimation strokes={strokes} label={`Strichreihenfolge von ${item.glyph.c}`} />
          <StrokeBoard strokes={strokes} mode="trace" strictness="relaxed" autoHintAfter={1} label="Nachzeichnen" onComplete={() => setTimeout(() => setPhase("recall"), 450)} />
        </div>
        <button className="link small text-center" onClick={() => setPhase("recall")}>Gleich aus dem Gedächtnis schreiben</button>
      </div>
    );
  }

  const finish = (summary: StrokeBoardSummary) => {
    const grade = gaveUp ? "again" : gradeAttempt(summary);
    setResult({ summary, grade });
    setPhase("result");
  };

  return (
    <div className={`card glyph-card ${result ? (result.grade === "again" ? "fb-wrong" : "fb-right") : ""}`}>
      <div className="row center-row">
        <span className="badge subtle">{KIND_LABEL[item.kind]}</span>
      </div>
      <WritePrompt glyph={item.glyph} />
      <div className="board-pair">
        <StrokeBoard
          ref={board}
          strokes={strokes}
          mode={gaveUp ? "trace" : "recall"}
          strictness={strictness}
          autoHintAfter={3}
          showNumbers={phase === "result"}
          disabled={phase === "result"}
          label="Aus dem Gedächtnis schreiben"
          onComplete={finish}
        />
        {phase === "result" && <GlyphAnimation strokes={strokes} label={`Lösung: ${item.glyph.c}`} />}
      </div>
      {phase === "result" && result ? (
        <>
          <div className={`verdict verdict-${result.grade === "again" ? "wrong" : "correct"}`} role="status">
            <b>{GRADE_LABEL[result.grade]}</b> – <span lang="ja">{item.glyph.c}</span>
          </div>
          <AttemptLine summary={result.summary} />
          <button className="primary wide" onClick={() => onDone(result.grade, result.summary.mistakes)} autoFocus>Weiter</button>
        </>
      ) : (
        <div className="row center-row">
          <button className="small-btn" onClick={() => board.current?.hint()} title="Nächsten Strich zeigen (zählt als Hilfe)">
            <IconWhy size={15} aria-hidden /> Hinweis
          </button>
          {!gaveUp && (
            <button
              className="small-btn"
              onClick={() => setGaveUp(true)}
              title="Zählt als falsch; die Vorlage erscheint und du schreibst das Zeichen fertig"
            >
              Weiß ich nicht
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AttemptLine({ summary }: { summary: StrokeBoardSummary }) {
  return (
    <div className="attempt-line small">
      <span>Genauigkeit <b>{Math.round(summary.accuracy * 100)} %</b></span>
      <span>{summary.mistakes === 0 ? "fehlerfrei" : `${summary.mistakes} Fehler`}</span>
      {summary.hints > 0 && <span>{summary.hints} {summary.hints === 1 ? "Hilfe" : "Hilfen"}</span>}
      {summary.responseMs !== null && <span>{(summary.responseMs / 1000).toFixed(1)} s</span>}
    </div>
  );
}
