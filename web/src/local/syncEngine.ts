import { api, ApiError } from "../api/client";
import type { LocalStore } from "./localStore";

export type SyncStatus = {
  online: boolean;
  syncing: boolean;
  pending: number;
  lastSync: number | null;
  error: string | null;
};

const PUSH_BATCH = 200;
const PULL_PAGE = 500;
const INTERVAL_MS = 20_000;

/**
 * Sync-Engine: schiebt die Outbox zum Server und zieht Änderungen seit dem
 * letzten Cursor. Läuft periodisch, bei Online-Wechsel und nach lokalen Schreibvorgängen.
 */
export class SyncEngine {
  private status: SyncStatus = {
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    syncing: false,
    pending: 0,
    lastSync: null,
    error: null,
  };
  private listeners = new Set<() => void>();
  private running = false;
  private rerun = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private kick: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly store: LocalStore,
    private readonly token: string,
  ) {
    this.status.pending = store.pendingCount;
    store.setOutboxListener(() => {
      this.status = { ...this.status, pending: store.pendingCount };
      this.emit();
      this.scheduleKick();
    });
  }

  start(): void {
    const onOnline = () => this.update({ online: true }, true);
    const onOffline = () => this.update({ online: false });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    this.timer = setInterval(() => void this.sync(), INTERVAL_MS);
    this.stopListening = () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    void this.sync();
  }

  private stopListening: () => void = () => {};

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.kick) clearTimeout(this.kick);
    this.stopListening();
    void this.store.flush();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getStatus = (): SyncStatus => this.status;

  async sync(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    this.update({ syncing: true, error: null });
    try {
      await this.pushAll();
      await this.pullAll();
      this.update({ online: true, syncing: false, lastSync: Date.now(), error: null });
    } catch (error) {
      const offline = error instanceof ApiError && error.status === 0;
      const unauthorized = error instanceof ApiError && error.status === 401;
      this.update({
        online: !offline,
        syncing: false,
        error: unauthorized ? "Sitzung abgelaufen" : offline ? null : "Synchronisation fehlgeschlagen",
      });
    } finally {
      this.running = false;
      await this.store.flush();
      if (this.rerun) {
        this.rerun = false;
        void this.sync();
      }
    }
  }

  private async pushAll(): Promise<void> {
    for (;;) {
      const batch = this.store.pendingBatch(PUSH_BATCH);
      if (batch.length === 0) return;
      const res = await api.push(
        this.token,
        batch.map((op) => ({ entity: op.entity, row: op.row })),
      );
      this.store.acknowledge(batch);
      if (res.rejected.length) console.warn("Server hat Zeilen abgelehnt:", res.rejected);
    }
  }

  private async pullAll(): Promise<void> {
    for (;;) {
      const page = await api.pull(this.token, this.store.cursor, PULL_PAGE);
      for (const change of page.changes) {
        this.store.applyRemote(change.entity, change.row as never);
      }
      this.store.setCursor(page.cursor);
      if (!page.hasMore) return;
    }
  }

  private scheduleKick() {
    if (this.kick) clearTimeout(this.kick);
    this.kick = setTimeout(() => void this.sync(), 800);
  }

  private update(patch: Partial<SyncStatus>, resync = false) {
    this.status = { ...this.status, ...patch, pending: this.store.pendingCount };
    this.emit();
    if (resync) void this.sync();
  }

  private emit() {
    this.listeners.forEach((fn) => fn());
  }
}
