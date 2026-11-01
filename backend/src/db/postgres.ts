import pg from "pg";
import { normalizeParams, toPgPlaceholders, type Db, type Param } from "./types.js";

// BIGINT (Zeitstempel in ms, COUNT) und NUMERIC als Zahl liefern statt als String.
pg.types.setTypeParser(20, (v: string) => Number(v));
pg.types.setTypeParser(1700, (v: string) => Number(v));

type Queryable = { query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> };

class PgDb implements Db {
  readonly dialect = "postgres" as const;
  constructor(
    private readonly pool: pg.Pool,
    private readonly client: Queryable | null,
  ) {}

  private q(sql: string, params?: Param[]) {
    const target: Queryable = this.client ?? this.pool;
    return target.query(toPgPlaceholders(sql), normalizeParams(params));
  }

  async all<T>(sql: string, params?: Param[]): Promise<T[]> {
    return (await this.q(sql, params)).rows as T[];
  }

  async get<T>(sql: string, params?: Param[]): Promise<T | undefined> {
    return (await this.q(sql, params)).rows[0] as T | undefined;
  }

  async run(sql: string, params?: Param[]): Promise<{ changes: number }> {
    return { changes: (await this.q(sql, params)).rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    const target: Queryable = this.client ?? this.pool;
    await target.query(sql);
  }

  async tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    if (this.client) return fn(this);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(new PgDb(this.pool, client));
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function openPostgres(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 10) });
  pool.on("error", (err) => console.error("Postgres-Pool-Fehler:", err.message));
  return new PgDb(pool, null);
}
