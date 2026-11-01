import { accuracyFor, type ReviewEvent } from "./review.js";
import { isDue, type CardStatus } from "./srs.js";

export interface PackInput {
  id: string;
  status: CardStatus;
  dueAt: number;
  createdAt: number;
  lapses: number;
}

export type PackReason = "schwach" | "wiederholen" | "fällig" | "neu";

export interface PackItem {
  cardId: string;
  reason: PackReason;
  priority: number;
}

export interface SmartPackOptions {
  now: number;
  size?: number;
  /** Zeitfenster für die Trefferquote (Standard: 7 Tage). */
  windowMs?: number;
  /** Eine Karte, die zuletzt falsch war, kommt nach dieser Wartezeit wieder in die Liste (Standard: 10 Min). */
  reinsertAfterMs?: number;
  /** Unter dieser Trefferquote gilt eine Karte als schwach. */
  weakBelow?: number;
  /** Höchstens so viele neue Karten pro Paket. */
  maxNew?: number;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Lernpaket: priorisiert Karten nach Schwäche (Trefferquote im Zeitfenster),
 * kürzlich falschen Antworten (nach Wartezeit wieder eingereiht), Fälligkeit und
 * neuen Karten. Gemeisterte Karten kommen nur zurück, wenn sie schwach sind.
 */
export function buildSmartPack(
  cards: PackInput[],
  events: ReviewEvent[],
  opts: SmartPackOptions,
): PackItem[] {
  const size = opts.size ?? 15;
  const windowMs = opts.windowMs ?? 7 * DAY;
  const reinsertAfterMs = opts.reinsertAfterMs ?? 10 * 60 * 1000;
  const weakBelow = opts.weakBelow ?? 0.7;
  const maxNew = opts.maxNew ?? 5;

  const scored: PackItem[] = [];
  let newCount = 0;
  for (const card of cards) {
    const acc = accuracyFor(events, card.id, opts.now, windowMs);
    // Wiedereinreihen nur, solange die letzte Antwort falsch war; eine spätere richtige Antwort beendet das.
    const lastWasWrong = acc.lastOutcome === "wrong" && acc.lastWrongAt !== null;
    const waitingForReinsert = lastWasWrong && opts.now - acc.lastWrongAt! >= reinsertAfterMs;
    const recentlyWrong = lastWasWrong && opts.now - acc.lastWrongAt! < reinsertAfterMs;
    // Schwach erst ab zwei Antworten im Fenster, sonst reicht ein Ausrutscher.
    const weak = acc.rate !== null && acc.right + acc.wrong >= 2 && acc.rate < weakBelow;

    if (card.status === "mastered" && !weak) continue;

    if (weak) {
      scored.push({ cardId: card.id, reason: "schwach", priority: 4 + (1 - (acc.rate ?? 0)) });
    } else if (waitingForReinsert || (recentlyWrong && card.status !== "new")) {
      scored.push({ cardId: card.id, reason: "wiederholen", priority: 3.5 });
    } else if (card.status !== "new" && isDue(card, opts.now)) {
      scored.push({ cardId: card.id, reason: "fällig", priority: 2 + Math.min(1, (opts.now - card.dueAt) / DAY) });
    } else if (card.status === "new") {
      if (newCount >= maxNew) continue;
      newCount++;
      scored.push({ cardId: card.id, reason: "neu", priority: 1 });
    }
  }

  return scored.sort((a, b) => b.priority - a.priority).slice(0, size);
}
