import type { SyncEntity } from "@vochat/shared";
import { loadEntries, removeKeys, saveEntries, type Kv } from "./kv";

export type Row = { id: string; updatedAt: number; deleted: boolean } & Record<string, unknown>;
type Listener = (rows: Row[]) => void;

const DATA = "data/";
const OUTBOX = "outbox/";
const CURSOR = "meta/cursor";

/**
 * Local-first-Speicher: Die App liest und schreibt ausschließlich hier. Lokale
 * Änderungen landen in einer Outbox und werden später an den Server gesendet;
 * Serverstände werden per Last-Write-Wins (updatedAt) eingemischt.
 */
export class LocalStore {
  private rows = new Map<string, Map<string, Row>>();
  private outbox = new Map<string, { entity: SyncEntity; row: Row }>();
  private listeners = new Map<SyncEntity, Set<Listener>>();
  private dirty = new Map<string, unknown | undefined>(); // key -> value (undefined = löschen)
  private cursorValue = 0;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private onOutboxChange: (() => void) | null = null;

  constructor(private readonly kv: Kv | null) {}

  async load(): Promise<void> {
    if (!this.kv) return;
    const entries = await loadEntries(this.kv);
    for (const [key, value] of entries) {
      if (key.startsWith(DATA)) {
        const [, entity, id] = key.split("/");
        this.table(entity as SyncEntity).set(id, value as Row);
      } else if (key.startsWith(OUTBOX)) {
        const [, entity, id] = key.split("/");
        const row = value as Row;
        this.outbox.set(`${entity}/${id}`, { entity: entity as SyncEntity, row });
      } else if (key === CURSOR) {
        this.cursorValue = Number(value) || 0;
      }
    }
  }

  setOutboxListener(fn: () => void) {
    this.onOutboxChange = fn;
  }

  get cursor(): number {
    return this.cursorValue;
  }

  get pendingCount(): number {
    return this.outbox.size;
  }

  all(entity: SyncEntity): Row[] {
    return [...this.table(entity).values()];
  }

  subscribe(entity: SyncEntity, fn: Listener): () => void {
    let set = this.listeners.get(entity);
    if (!set) this.listeners.set(entity, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }

  /** Lokale Schreibung: sofort sichtbar, wird in die Outbox gelegt. */
  upsertLocal(entity: SyncEntity, row: Row): void {
    this.table(entity).set(row.id, row);
    this.outbox.set(`${entity}/${row.id}`, { entity, row });
    this.persist(DATA + `${entity}/${row.id}`, row);
    this.persist(OUTBOX + `${entity}/${row.id}`, row);
    this.emit(entity, [row]);
    this.onOutboxChange?.();
  }

  /** Serverstand einmischen. Lokal neuere, noch nicht gesendete Änderungen gewinnen. */
  applyRemote(entity: SyncEntity, row: Row): void {
    const current = this.table(entity).get(row.id);
    if (current && current.updatedAt > row.updatedAt) return;
    const pending = this.outbox.get(`${entity}/${row.id}`);
    if (pending && pending.row.updatedAt > row.updatedAt) return;
    this.table(entity).set(row.id, row);
    if (pending) {
      this.outbox.delete(`${entity}/${row.id}`);
      this.persist(OUTBOX + `${entity}/${row.id}`, undefined);
    }
    this.persist(DATA + `${entity}/${row.id}`, row);
    this.emit(entity, [row]);
  }

  /** Nach erfolgreichem Push: Einträge aus der Outbox entfernen, sofern nicht inzwischen geändert. */
  acknowledge(sent: { entity: SyncEntity; row: Row }[]): void {
    for (const op of sent) {
      const key = `${op.entity}/${op.row.id}`;
      const pending = this.outbox.get(key);
      if (pending && pending.row.updatedAt === op.row.updatedAt) {
        this.outbox.delete(key);
        this.persist(OUTBOX + key, undefined);
      }
    }
    this.onOutboxChange?.();
  }

  pendingBatch(limit: number): { entity: SyncEntity; row: Row }[] {
    return [...this.outbox.values()].slice(0, limit);
  }

  setCursor(value: number): void {
    this.cursorValue = value;
    this.persist(CURSOR, value);
  }

  /** Schreibt ausstehende Änderungen gebündelt in IndexedDB. */
  private persist(key: string, value: unknown): void {
    if (!this.kv) return;
    this.dirty.set(key, value);
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => void this.flush(), 150);
  }

  async flush(): Promise<void> {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    if (!this.kv || this.dirty.size === 0) return;
    const writes: [string, unknown][] = [];
    const deletes: string[] = [];
    for (const [key, value] of this.dirty) {
      if (value === undefined) deletes.push(key);
      else writes.push([key, value]);
    }
    this.dirty.clear();
    try {
      await saveEntries(this.kv, writes);
      await removeKeys(this.kv, deletes);
    } catch {
      // Speicher voll oder gesperrt: Daten bleiben im Arbeitsspeicher
    }
  }

  private table(entity: SyncEntity): Map<string, Row> {
    let t = this.rows.get(entity);
    if (!t) this.rows.set(entity, (t = new Map()));
    return t;
  }

  private emit(entity: SyncEntity, rows: Row[]) {
    this.listeners.get(entity)?.forEach((fn) => fn(rows));
  }
}
