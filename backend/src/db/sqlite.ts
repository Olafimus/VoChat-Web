import { DatabaseSync, type StatementSync } from "node:sqlite";
import { normalizeParams, type Db, type Param } from "./types.js";

/**
 * SQLite über das eingebaute `node:sqlite`. Die Aufrufe selbst sind synchron; damit sich
 * gleichzeitige Anfragen nicht in eine offene Transaktion mischen, laufen alle Zugriffe
 * über eine gemeinsame Sperre. Innerhalb einer Transaktion wird die Sperre nicht erneut genommen.
 */
interface Shared {
  raw: DatabaseSync;
  statements: Map<string, StatementSync>;
  queue: Promise<void>;
}

class SqliteDb implements Db {
  readonly dialect = "sqlite" as const;
  constructor(
    private readonly shared: Shared,
    private readonly inTx: boolean,
  ) {}

  private stmt(sql: string): StatementSync {
    let s = this.shared.statements.get(sql);
    if (!s) {
      s = this.shared.raw.prepare(sql);
      this.shared.statements.set(sql, s);
    }
    return s;
  }

  private async exclusive<T>(fn: () => T | Promise<T>): Promise<T> {
    if (this.inTx) return fn();
    const previous = this.shared.queue;
    let release!: () => void;
    this.shared.queue = new Promise<void>((resolve) => (release = resolve));
    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  all<T>(sql: string, params?: Param[]): Promise<T[]> {
    return this.exclusive(() => this.stmt(sql).all(...(normalizeParams(params) as never[])) as T[]);
  }

  get<T>(sql: string, params?: Param[]): Promise<T | undefined> {
    return this.exclusive(() => this.stmt(sql).get(...(normalizeParams(params) as never[])) as T | undefined);
  }

  run(sql: string, params?: Param[]): Promise<{ changes: number }> {
    return this.exclusive(() => {
      const r = this.stmt(sql).run(...(normalizeParams(params) as never[]));
      return { changes: Number(r.changes) };
    });
  }

  exec(sql: string): Promise<void> {
    return this.exclusive(() => this.shared.raw.exec(sql));
  }

  tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    if (this.inTx) return fn(this);
    return this.exclusive(async () => {
      this.shared.raw.exec("BEGIN IMMEDIATE");
      try {
        const result = await fn(new SqliteDb(this.shared, true));
        this.shared.raw.exec("COMMIT");
        return result;
      } catch (error) {
        this.shared.raw.exec("ROLLBACK");
        throw error;
      }
    });
  }

  async close(): Promise<void> {
    this.shared.raw.close();
  }
}

export function openSqlite(path: string): Db {
  const raw = new DatabaseSync(path);
  raw.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");
  return new SqliteDb({ raw, statements: new Map(), queue: Promise.resolve() }, false);
}
