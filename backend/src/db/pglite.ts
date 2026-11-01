import type { PGlite as PGliteType, Transaction } from "@electric-sql/pglite";
import { normalizeParams, toPgPlaceholders, type Db, type Param } from "./types.js";

/**
 * Postgres im Prozess (PGlite, WebAssembly). Für Tests und lokale Entwicklung ohne Server –
 * derselbe SQL-Dialekt wie der echte Postgres-Treiber.
 */
type Target = Pick<PGliteType, "query" | "exec"> | Transaction;

class PgliteDb implements Db {
  readonly dialect = "postgres" as const;
  constructor(
    private readonly root: PGliteType,
    private readonly target: Target,
    private readonly inTx: boolean,
  ) {}

  async all<T>(sql: string, params?: Param[]): Promise<T[]> {
    return (await this.target.query<T>(toPgPlaceholders(sql), normalizeParams(params))).rows;
  }

  async get<T>(sql: string, params?: Param[]): Promise<T | undefined> {
    return (await this.all<T>(sql, params))[0];
  }

  async run(sql: string, params?: Param[]): Promise<{ changes: number }> {
    const r = await this.target.query(toPgPlaceholders(sql), normalizeParams(params));
    return { changes: r.affectedRows ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.target.exec(sql);
  }

  tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    if (this.inTx) return fn(this);
    return this.root.transaction((t) => fn(new PgliteDb(this.root, t, true)));
  }

  async close(): Promise<void> {
    await this.root.close();
  }
}

export async function openPglite(dataDir?: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const root = new PGlite(dataDir);
  await root.waitReady;
  return new PgliteDb(root, root, false);
}
