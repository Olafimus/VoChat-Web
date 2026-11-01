import { clear, createStore, delMany, getMany, keys, setMany, type UseStore } from "idb-keyval";

export type Kv = UseStore;

/**
 * Lokaler Speicher des Geräts (IndexedDB). Ein Schlüssel je Zeile, damit Schreibvorgänge
 * klein bleiben. Ohne IndexedDB läuft die App im Arbeitsspeicher weiter.
 */
export function openLocalKv(): Kv | null {
  try {
    return createStore("vochat-device", "rows");
  } catch {
    return null;
  }
}

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

export async function clearLocalKv(kv: Kv): Promise<void> {
  try {
    await clear(kv);
  } catch {
    // ignorieren
  }
}
