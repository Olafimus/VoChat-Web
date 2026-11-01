/**
 * Lernplaner: Was ist jetzt dran – und warum?
 *
 * 1. Wiederlernen: zuletzt falsch beantwortete Karten (nach kurzer Pause in derselben Sitzung).
 * 2. Wiederholen: fällige Karten, sortiert nach aktueller Erinnerungswahrscheinlichkeit – was am
 *    ehesten vergessen ist, kommt zuerst. Fälligkeit = Erinnerung fällt unter die Zielquote.
 * 3. Neu: nach Wichtigkeit (Häufigkeit, passendes Niveau, Herkunft wie laufende Challenge oder
 *    eigener Scan, vom Nutzer vorgezogen) – begrenzt durch „neue Wörter pro Tag“ und gebremst,
 *    wenn sich Wiederholungen stauen.
 *
 * Neue Karten werden zwischen die Wiederholungen gemischt (jede vierte Position), damit Blöcke
 * abwechslungsreich bleiben. Jede Entscheidung trägt lesbare Gründe – keine Black Box.
 */
import { CEFR_LEVELS, type Cefr } from "./languages.js";
import { DAY_MS, retrievability } from "./memory.js";
import { DEFAULT_RETENTION } from "./srs.js";

export interface PlannerCard {
  id: string;
  status: "new" | "learning" | "review" | "mastered";
  stability: number;
  dueAt: number;
  lastReviewAt: number | null;
  createdAt: number;
  lapses: number;
  ignored?: boolean;
  pinned?: boolean;
  retention?: number | null;
  rank?: number | null;
  cefr?: string | null;
  origin?: string | null;
}

export interface PlannerSettings {
  /** Zielquote: Wahrscheinlichkeit, mit der ein Wort bei der Wiederholung noch sitzt (0,8–0,97). */
  retention: number;
  newPerDay: number;
  /** Ab so vielen fälligen Wiederholungen gibt es keine neuen Wörter mehr. */
  maxReviewsPerDay: number;
  targetCefr?: Cefr | null;
  /** Herkünfte mit Vorrang, z. B. laufende Challenges ("challenge:<id>"). */
  activeOrigins?: string[];
}

export const DEFAULT_PLANNER: PlannerSettings = { retention: DEFAULT_RETENTION, newPerDay: 10, maxReviewsPerDay: 150 };

export type PlanKind = "relearn" | "review" | "new";

export interface PlanItem {
  cardId: string;
  kind: PlanKind;
  /** Erinnerungswahrscheinlichkeit jetzt (null bei neuen Karten). */
  recallNow: number | null;
  score: number;
  reasons: string[];
}

export interface Plan {
  items: PlanItem[];
  relearn: number;
  due: number;
  newAvailable: number;
  newIntroducedToday: number;
  newAllowed: number;
  reviewsToday: number;
  /** Geschätzte Minuten für alle geplanten Karten. */
  minutes: number;
  /** Fällige Wiederholungen der nächsten 14 Tage (Index 0 = heute, inkl. Rückstand). */
  forecast: number[];
  notes: string[];
}

export interface PlannerReview {
  cardId: string;
  at: number;
  responseMs?: number | null;
}

const LOG_MAX_RANK = Math.log10(50_000);

/** Wichtigkeit einer neuen Karte (≈0–2) mit Begründung. */
export function importance(card: PlannerCard, settings: PlannerSettings): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (card.pinned) {
    score += 2;
    reasons.push("von dir vorgezogen");
  }
  if (card.rank) {
    const f = Math.max(0, 1 - Math.log10(card.rank) / LOG_MAX_RANK);
    score += f;
    reasons.push(`Häufigkeitsrang ${card.rank}${card.rank <= 1000 ? " (Grundwortschatz)" : ""}`);
  } else score += 0.3;
  const target = settings.targetCefr ? CEFR_LEVELS.indexOf(settings.targetCefr) : -1;
  const level = card.cefr ? CEFR_LEVELS.indexOf(card.cefr as Cefr) : -1;
  if (target >= 0 && level >= 0) {
    if (level <= target) {
      score += 0.3;
      reasons.push(`Niveau ${card.cefr} passt zu deinem Ziel ${settings.targetCefr}`);
    } else if (level >= target + 2) {
      score -= 0.3;
      reasons.push(`Niveau ${card.cefr} liegt deutlich über deinem Ziel`);
    }
  } else if (level >= 0 && level <= 1) {
    score += 0.15;
    reasons.push(`Niveau ${card.cefr}`);
  }
  const origin = card.origin ?? "";
  if (origin && settings.activeOrigins?.includes(origin)) {
    score += 0.5;
    reasons.push("Teil einer laufenden Challenge");
  } else if (origin.startsWith("collection:")) {
    score += 0.2;
    reasons.push("aus einer deiner Sammlungen");
  } else if (origin === "scan" || origin === "chat" || origin === "manual") {
    score += 0.15;
    reasons.push(origin === "scan" ? "selbst in einem Text gefunden" : "selbst hinzugefügt");
  }
  return { score, reasons };
}

const fmtPct = (x: number) => `${Math.round(x * 100)} %`;

export function buildPlan(
  cards: PlannerCard[],
  reviews: PlannerReview[],
  settings: PlannerSettings,
  now: number,
  startOfToday: number,
): Plan {
  const active = cards.filter((c) => !c.ignored);
  const notes: string[] = [];

  // Heute bereits eingeführte neue Karten und Wiederholungen
  const firstReview = new Map<string, number>();
  let reviewsToday = 0;
  const times: number[] = [];
  for (const r of reviews) {
    const prev = firstReview.get(r.cardId);
    if (prev === undefined || r.at < prev) firstReview.set(r.cardId, r.at);
    if (r.at >= startOfToday) reviewsToday++;
    if (r.responseMs && r.responseMs < 120_000) times.push(r.responseMs);
  }
  const newIntroducedToday = [...firstReview.values()].filter((t) => t >= startOfToday).length;

  const relearn: PlanItem[] = [];
  const due: PlanItem[] = [];
  const fresh: PlanItem[] = [];
  const forecast = Array.from({ length: 14 }, () => 0);

  for (const c of active) {
    if (c.status === "new" || c.lastReviewAt === null) {
      const imp = importance(c, settings);
      fresh.push({ cardId: c.id, kind: "new", recallNow: null, score: imp.score - c.createdAt / 1e15, reasons: imp.reasons });
      continue;
    }
    const bucket = Math.max(0, Math.floor((c.dueAt - startOfToday) / DAY_MS));
    if (bucket < 14) forecast[bucket]++;
    if (c.dueAt > now) continue;
    const target = c.retention ?? settings.retention;
    const recall = retrievability((now - c.lastReviewAt) / DAY_MS, c.stability);
    if (c.status === "learning" && c.stability < 1 && now - c.lastReviewAt < DAY_MS) {
      relearn.push({
        cardId: c.id,
        kind: "relearn",
        recallNow: recall,
        score: 10 - recall,
        reasons: ["zuletzt falsch oder noch frisch – kurz danach festigen"],
      });
      continue;
    }
    const overdueDays = (now - c.dueAt) / DAY_MS;
    const reasons = [`Erinnerung jetzt ≈ ${fmtPct(recall)} (Ziel ${fmtPct(target)})`];
    if (overdueDays >= 1) reasons.push(`fällig seit ${Math.floor(overdueDays)} ${Math.floor(overdueDays) === 1 ? "Tag" : "Tagen"}`);
    if (c.lapses >= 3) reasons.push(`${c.lapses}× vergessen – braucht Aufmerksamkeit`);
    if (c.pinned) reasons.push("von dir vorgezogen");
    if (c.retention && c.retention > settings.retention) reasons.push("du willst dieses Wort öfter üben");
    due.push({ cardId: c.id, kind: "review", recallNow: recall, score: (c.pinned ? 2 : 0) + (target - recall), reasons });
  }

  relearn.sort((a, b) => b.score - a.score);
  due.sort((a, b) => b.score - a.score);
  fresh.sort((a, b) => b.score - a.score);

  // Neue Wörter: Tageslimit, gebremst bei Rückstand
  let newAllowed = Math.max(0, settings.newPerDay - newIntroducedToday);
  const backlog = due.length + relearn.length;
  const half = settings.maxReviewsPerDay / 2;
  if (backlog >= settings.maxReviewsPerDay) {
    if (newAllowed > 0) notes.push(`${backlog} Wiederholungen offen – heute keine neuen Wörter, erst den Rückstand abbauen.`);
    newAllowed = 0;
  } else if (backlog > half && newAllowed > 0) {
    const reduced = Math.round(newAllowed * (1 - (backlog - half) / half));
    if (reduced < newAllowed) notes.push(`Viele Wiederholungen offen – neue Wörter heute auf ${reduced} reduziert.`);
    newAllowed = reduced;
  }
  if (newIntroducedToday >= settings.newPerDay && fresh.length > 0) notes.push(`Tageslimit von ${settings.newPerDay} neuen Wörtern erreicht.`);
  const pinnedIds = new Set(active.filter((c) => c.pinned).map((c) => c.id));
  const pinnedNew = fresh.filter((f) => pinnedIds.has(f.cardId));
  const chosenNew = [...pinnedNew, ...fresh.filter((f) => !pinnedNew.includes(f)).slice(0, Math.max(0, newAllowed - pinnedNew.length))];

  // Mischen: Wiederlernen zuerst, dann Wiederholungen mit jeder vierten Position neu
  const items: PlanItem[] = [...relearn];
  let ni = 0;
  for (let i = 0; i < due.length; i++) {
    if (i > 0 && i % 3 === 0 && ni < chosenNew.length) items.push(chosenNew[ni++]);
    items.push(due[i]);
  }
  while (ni < chosenNew.length) items.push(chosenNew[ni++]);

  const avgSec = times.length >= 10 ? times.reduce((a, b) => a + b, 0) / times.length / 1000 : 8;
  const minutes = Math.ceil(((relearn.length + due.length) * avgSec + chosenNew.length * avgSec * 2.5) / 60);

  return {
    items,
    relearn: relearn.length,
    due: due.length,
    newAvailable: fresh.length,
    newIntroducedToday,
    newAllowed: chosenNew.length,
    reviewsToday,
    minutes,
    forecast,
    notes,
  };
}
