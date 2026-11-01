import { api, ApiError } from "../api/client";
import type { LocalStore } from "./localStore";

export type SyncStatus = {
  enabled: boolean;
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
 * Sync-Engine. Ohne Konto ist sie deaktiviert: die App bleibt voll nutzbar, nur die
 * Übertragung an den Server fehlt. Mit Konto schiebt sie die Outbox und zieht Änderungen.
 */
export class SyncEngine {
  private status: SyncStatus;
  private listeners = new Set<() => void>();
  private running = false;
  private rerun = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private kick: ReturnType<typeof setTimeout> | null = null;
  private detachListeners: () => void = () => {};

  constructor(
    private readonly store: LocalStore,
    private readonly token: string | null,
    private readonly accountId: string | null,
  ) {
    this.status = {
      enabled: token !== null && accountId !== null,
      online: typeof navigator === "undefined" ? true : navigator.onLine,
      syncing: false,
      pending: store.pendingCount,
      lastSync: null,
      error: null,
    };
    store.setOutboxListener(() => {
      this.update({});
      if (this.status.enabled) this.scheduleKick();
    });
  }

  start(): void {
    if (!this.status.enabled) return;
    const onOnline = () => this.update({ online: true }, true);
    const onOffline = () => this.update({ online: false });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    this.detachListeners = () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    this.timer = setInterval(() => void this.sync(), INTERVAL_MS);
    void this.sync();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.kick) clearTimeout(this.kick);
    this.detachListeners();
    void this.store.flush();
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getStatus = (): SyncStatus => this.status;

  async sync(): Promise<void> {
    if (!this.status.enabled || !this.token || !this.accountId) return;
    if (this.running) {
      this.rerun = true;
      return;
    }
    this.running = true;
    this.update({ syncing: true, error: null });
    try {
      await this.pushAll(this.token);
      await this.pullAll(this.token, this.accountId);
      this.update({ online: true, syncing: false, lastSync: Date.now(), error: null });
    } catch (error) {
      const offline = error instanceof ApiError && error.status === 0;
      const unauthorized = error instanceof ApiError && error.status === 401;
      this.update({
        online: !offline,
        syncing: false,
        error: unauthorized ? "Anmeldung abgelaufen – bitte neu anmelden" : offline ? null : "Synchronisation fehlgeschlagen",
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

  private async pushAll(token: string): Promise<void> {
    for (;;) {
      const batch = this.store.pendingBatch(PUSH_BATCH);
      if (batch.length === 0) return;
      const res = await api.push(token, batch.map((op) => ({ entity: op.entity, row: op.row })));
      this.store.acknowledge(batch);
      if (res.rejected.length) console.warn("Server hat Zeilen abgelehnt:", res.rejected);
    }
  }

  private async pullAll(token: string, accountId: string): Promise<void> {
    for (;;) {
      const page = await api.pull(token, this.store.cursorFor(accountId), PULL_PAGE);
      for (const change of page.changes) {
        this.store.applyRemote(change.entity, change.row as never);
      }
      this.store.setCursor(accountId, page.cursor);
      if (!page.hasMore) return;
    }
  }

  private scheduleKick() {
    if (this.kick) clearTimeout(this.kick);
    this.kick = setTimeout(() => void this.sync(), 800);
  }

  private update(patch: Partial<SyncStatus>, resync = false) {
    this.status = { ...this.status, ...patch, pending: this.store.pendingCount };
    this.listeners.forEach((fn) => fn());
    if (resync) void this.sync();
  }
}
