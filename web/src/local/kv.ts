import { clear, createStore, delMany, getMany, keys, setMany, type UseStore } from "idb-keyval";

/**
 * Lokaler Speicher pro Nutzer (IndexedDB). Jede Zeile ist ein eigener Schlüssel,
 * damit Schreibvorgänge klein bleiben. Fällt IndexedDB aus, arbeitet die App
 * rein im Speicher weiter – Synchronisation läuft dann beim nächsten Start nach.
 */
export function openUserKv(userId: string): UseStore | null {
  try {
    return createStore(`vochat-${userId}`, "rows");
  } catch {
    return null;
  }
}

export type Kv = UseStore;

export async function loadEntries(kv: Kv): Promise<Map<string, unknown>> {
  const result = new Map<string, unknown>();
  try {
    const allKeys = (await keys(kv)) as string[];
    const values = await getMany(allKeys, kv);
    allKeys.forEach((k, i) => result.set(k, values[i]));
  } catch {
    // ohne Persistenz startet die App leer
  }
  return result;
}

export async function saveEntries(kv: Kv, entries: [string, unknown][]): Promise<void> {
  if (entries.length) await setMany(entries, kv);
}

export async function removeKeys(kv: Kv, keysToDelete: string[]): Promise<void> {
  if (keysToDelete.length) await delMany(keysToDelete, kv);
}

export async function clearUserKv(kv: Kv): Promise<void> {
  try {
    await clear(kv);
  } catch {
    // ignorieren: Speicher war ohnehin nicht verfügbar
  }
}
