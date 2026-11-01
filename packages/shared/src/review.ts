/** Lernereignisse: jede Antwort wird protokolliert, daraus entstehen Trefferquoten und Lernpakete. */

export type Mode = "flip" | "reverse" | "type";
export type Outcome = "right" | "wrong";

export interface ReviewEvent {
  cardId: string;
  outcome: Outcome;
  mode: Mode;
  at: number;
}

export interface Accuracy {
  right: number;
  wrong: number;
  /** Trefferquote im Zeitfenster, null wenn keine Antworten vorliegen. */
  rate: number | null;
  lastWrongAt: number | null;
}

export function accuracyFor(events: ReviewEvent[], cardId: string, now: number, windowMs: number): Accuracy {
  let right = 0;
  let wrong = 0;
  let lastWrongAt: number | null = null;
  for (const e of events) {
    if (e.cardId !== cardId || e.at < now - windowMs) continue;
    if (e.outcome === "right") right++;
    else {
      wrong++;
      if (lastWrongAt === null || e.at > lastWrongAt) lastWrongAt = e.at;
    }
  }
  const total = right + wrong;
  return { right, wrong, rate: total === 0 ? null : right / total, lastWrongAt };
}
