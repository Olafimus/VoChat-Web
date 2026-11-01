/** Lernereignisse: jede Antwort wird protokolliert (append-only) und speist das Gedächtnismodell. */
import type { Grade } from "./memory.js";

/** "manual" = vom Nutzer als bekannt markiert, keine echte Abfrage. */
export type Mode = "flip" | "reverse" | "type" | "manual";
export type Outcome = "right" | "wrong";

export interface ReviewEvent {
  cardId: string;
  outcome: Outcome;
  grade?: Grade | null;
  mode: Mode;
  at: number;
  responseMs?: number | null;
}
