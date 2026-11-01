import { useEffect, useRef } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { useSession } from "../session";
import type { CardRow } from "../local/collections";
import { migrateSchedules } from "./cards";

/**
 * Karten aus älteren Versionen (oder von anderen Geräten) ohne Modellwerte einmal aus ihrer
 * Historie berechnen. Läuft im Hintergrund, sobald Karten und Historie geladen sind.
 */
export function useScheduleMigration(): void {
  const { collections } = useSession();
  const cards = (useLiveQuery(() => collections.cards).data ?? []) as CardRow[];
  const reviewsReady = (useLiveQuery(() => collections.reviews).data ?? []).length;
  const last = useRef("");
  useEffect(() => {
    const pending = cards.filter((c) => !c.deleted && (c.stability === undefined || (c.reps > 0 && !c.stability)));
    const key = pending.map((c) => c.id).join(",");
    if (pending.length === 0 || key === last.current) return;
    last.current = key;
    const t = setTimeout(() => migrateSchedules(collections, pending), 500);
    return () => clearTimeout(t);
  }, [cards, reviewsReady, collections]);
}
