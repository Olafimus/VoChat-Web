import { useEffect } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { useSession, useSyncStatus } from "../session";
import type { CardRow, MediaCollectionRow } from "../local/collections";
import { linkWithDictionary } from "./linker";

/**
 * Startet den Abgleich mit dem Wörterbuch im Hintergrund: nach dem Start, beim Online-Werden und
 * wenn neue Karten oder Sammlungen dazukommen. Gedrosselt im Linker selbst (alle 10 Minuten).
 */
export function useDictionaryLinker(): void {
  const { collections, user } = useSession();
  const status = useSyncStatus();
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];
  const own = (useLiveQuery((q) => collections.collections).data ?? []) as MediaCollectionRow[];

  useEffect(() => {
    if (!status.online) return;
    const t = setTimeout(() => {
      linkWithDictionary(collections, cards, own, user.nativeLang).catch(() => undefined);
    }, 2000);
    return () => clearTimeout(t);
    // Bewusst nur bei Änderungen der Anzahl, nicht bei jeder einzelnen Kartenänderung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.online, cards.length, own.length, user.nativeLang, collections]);
}
