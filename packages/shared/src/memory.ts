/**
 * Gedächtnismodell: Wie gut sitzt ein Wort, und wann sollte es wiederholt werden?
 *
 * Grundlage ist FSRS (Free Spaced Repetition Scheduler, Version 5 – offen, an Hunderten Millionen
 * echter Wiederholungen angepasst). Jede Karte hat zwei Werte:
 *
 *  - Stabilität S (Tage): nach S Tagen liegt die Erinnerungswahrscheinlichkeit bei 90 %.
 *  - Schwierigkeit D (1–10): wie schwer das Wort für diese Person ist; bremst den Zuwachs.
 *
 * Die Erinnerungswahrscheinlichkeit nach t Tagen ist R(t) = (1 + F·t/S)^C (Potenzgesetz des Vergessens).
 *
 * Entscheidend ist der zeitliche Abstand: Eine richtige Antwort bringt umso mehr, je wahrscheinlicher
 * man das Wort schon vergessen hätte (kleines R). Richtig nach einer Woche Pause zählt viel, richtig
 * fünf Sekunden nach einem Fehler fast nichts. Innerhalb eines Tages skaliert der Zuwachs mit dem
 * seit der letzten Antwort eingetretenen Vergessen (eigene Ergänzung zu FSRS, siehe `sameDayGain`).
 *
 * Alles wird aus der vollständigen Lernhistorie neu berechnet (`replay`). Dadurch ist jeder Schritt
 * nachvollziehbar, und Geräte, die offline gelernt haben, kommen nach dem Sync zum selben Ergebnis.
 * Reine Funktionen ohne I/O: Client und Server rechnen identisch.
 */

export type Grade = "again" | "hard" | "good" | "easy";
export const GRADE_VALUE: Record<Grade, 1 | 2 | 3 | 4> = { again: 1, hard: 2, good: 3, easy: 4 };

/** FSRS-5-Standardgewichte (w0…w18). */
export const FSRS_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605,
  2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81; // so gewählt, dass R(S) = 0.9
export const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_STABILITY = 0.01;
export const MAX_STABILITY = 36500;
/** Nach einem Fehler: kurz danach in derselben Sitzung noch einmal (Wiederlernschritt). */
export const RELEARN_MS = 10 * 60 * 1000;

export interface MemoryState {
  stability: number;
  difficulty: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const w = FSRS_WEIGHTS;

/** Erinnerungswahrscheinlichkeit nach `elapsedDays` bei Stabilität `stability`. */
export function retrievability(elapsedDays: number, stability: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + (FACTOR * Math.max(0, elapsedDays)) / stability, DECAY);
}

/** Abstand in Tagen, nach dem R auf `retention` gefallen ist. */
export function intervalDays(stability: number, retention: number): number {
  return (stability / FACTOR) * (Math.pow(retention, 1 / DECAY) - 1);
}

const initDifficulty = (g: number) => clamp(w[4] - Math.exp(w[5] * (g - 1)) + 1, 1, 10);

export function initialState(grade: Grade): MemoryState {
  const g = GRADE_VALUE[grade];
  return { stability: clamp(w[g - 1], MIN_STABILITY, MAX_STABILITY), difficulty: initDifficulty(g) };
}

function nextDifficulty(d: number, g: number): number {
  const delta = -w[6] * (g - 3);
  const damped = d + (delta * (10 - d)) / 9; // je näher an 10, desto kleiner die Änderung
  const reverted = w[7] * initDifficulty(4) + (1 - w[7]) * damped; // leichte Rückkehr zum Mittel
  return clamp(reverted, 1, 10);
}

function recallStability(s: number, d: number, r: number, g: number): number {
  const hard = g === 2 ? w[15] : 1;
  const easy = g === 4 ? w[16] : 1;
  return s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy);
}

function forgetStability(s: number, d: number, r: number): number {
  const sf = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  return Math.min(sf, s);
}

/**
 * Zuwachs am selben Tag. FSRS-5 multipliziert hier pauschal mit exp(w17·(G−3+w18)). Wir gewichten den
 * Zuwachs zusätzlich mit dem Vergessen seit der letzten Antwort: φ = (1−R)/(1−0,9), begrenzt auf [0, 1].
 * 5 s nach einem Fehler ist R ≈ 1 → φ ≈ 0 → praktisch kein Zuwachs. Ein Rückgang (Fehler) gilt voll.
 */
function sameDayGain(s: number, g: number, r: number): number {
  const factor = Math.exp(w[17] * (g - 3 + w[18]));
  if (factor <= 1) return s * factor;
  const phi = clamp((1 - r) / 0.1, 0, 1);
  return s * Math.pow(factor, phi);
}

/** Neuer Zustand nach einer Antwort. `elapsedDays`: Zeit seit der vorigen Antwort (beliebig klein). */
export function nextState(prev: MemoryState, grade: Grade, elapsedDays: number): MemoryState {
  const g = GRADE_VALUE[grade];
  const r = retrievability(elapsedDays, prev.stability);
  const difficulty = nextDifficulty(prev.difficulty, g);
  let stability: number;
  if (elapsedDays < 1) stability = sameDayGain(prev.stability, g, r);
  else if (g === 1) stability = forgetStability(prev.stability, prev.difficulty, r);
  else stability = recallStability(prev.stability, prev.difficulty, r, g);
  return { stability: clamp(stability, MIN_STABILITY, MAX_STABILITY), difficulty };
}

export interface ReviewInput {
  at: number;
  grade: Grade;
}

/** Ein Schritt der Lernhistorie – genau das, was die Statistik dem Nutzer zeigt. */
export interface ReplayStep {
  at: number;
  grade: Grade;
  /** Pause seit der vorigen Antwort (Tage); null bei der ersten Antwort. */
  elapsedDays: number | null;
  /** Erinnerungswahrscheinlichkeit unmittelbar vor der Antwort (null bei der ersten). */
  recall: number | null;
  stabilityBefore: number | null;
  stabilityAfter: number;
  difficultyAfter: number;
  /** Faktor, um den die Stabilität gewachsen (>1) oder geschrumpft (<1) ist. */
  gain: number | null;
  /** Kurzbewertung des Schritts. */
  quality: "start" | "strong" | "solid" | "weak" | "lapse";
}

export interface Replay {
  state: MemoryState | null;
  steps: ReplayStep[];
  lastReviewAt: number | null;
  reps: number;
  lapses: number;
}

/** Wiederholungen in zeitlicher Reihenfolge durchrechnen. */
export function replay(reviews: ReviewInput[]): Replay {
  const sorted = [...reviews].sort((a, b) => a.at - b.at);
  let state: MemoryState | null = null;
  let last: number | null = null;
  let lapses = 0;
  const steps: ReplayStep[] = [];
  for (const rv of sorted) {
    if (!state || last === null) {
      state = initialState(rv.grade);
      steps.push({
        at: rv.at,
        grade: rv.grade,
        elapsedDays: null,
        recall: null,
        stabilityBefore: null,
        stabilityAfter: state.stability,
        difficultyAfter: state.difficulty,
        gain: null,
        quality: "start",
      });
    } else {
      const elapsed = (rv.at - last) / DAY_MS;
      const recall = retrievability(elapsed, state.stability);
      const before = state.stability;
      state = nextState(state, rv.grade, elapsed);
      const gain = state.stability / before;
      if (rv.grade === "again") lapses++;
      steps.push({
        at: rv.at,
        grade: rv.grade,
        elapsedDays: elapsed,
        recall,
        stabilityBefore: before,
        stabilityAfter: state.stability,
        difficultyAfter: state.difficulty,
        gain,
        quality: rv.grade === "again" ? "lapse" : gain >= 2 ? "strong" : gain >= 1.15 ? "solid" : "weak",
      });
    }
    last = rv.at;
  }
  return { state, steps, lastReviewAt: last, reps: sorted.length, lapses };
}

/** Kleine, deterministische Streuung (±5 %) ab 3 Tagen, damit nicht alles am selben Tag fällig wird. */
export function fuzzFactor(seed: string, days: number): number {
  if (days < 3) return 1;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return 0.95 + ((h >>> 0) % 1000) / 10000;
}

/** Fälligkeit aus dem Zustand: nach einem Fehler kurzer Wiederlernschritt, sonst Intervall bei Zielquote. */
export function dueAfter(state: MemoryState, lastAt: number, lastGrade: Grade, retention: number, seed = ""): number {
  if (lastGrade === "again") return lastAt + RELEARN_MS;
  const days = intervalDays(state.stability, retention);
  return lastAt + Math.max(RELEARN_MS, Math.round(days * fuzzFactor(seed + lastAt, days) * DAY_MS));
}

export type CardStatus = "new" | "learning" | "review" | "mastered";

/** Status für die Anzeige: lernend unter 1 Tag Stabilität, „sitzt“ ab 60 Tagen. */
export function statusFor(state: MemoryState | null, lastGrade: Grade | null): CardStatus {
  if (!state) return "new";
  if (lastGrade === "again" || state.stability < 1) return "learning";
  return state.stability >= 60 ? "mastered" : "review";
}
