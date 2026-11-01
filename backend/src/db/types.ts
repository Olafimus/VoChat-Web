export type Dialect = "sqlite" | "postgres";
export type Param = string | number | null | boolean | undefined;

/**
 * Asynchrone Datenbank-Schnittstelle für SQLite und Postgres.
 * SQL wird mit `?`-Platzhaltern geschrieben; der Postgres-Treiber wandelt sie in `$1, $2 …` um.
 * Portabel bleiben: keine benannten Parameter, keine COLLATE NOCASE, keine JSON-Funktionen,
 * camelCase-Aliase nur in doppelten Anführungszeichen (Postgres schreibt sonst klein).
 */
export interface Db {
  readonly dialect: Dialect;
  all<T = Record<string, unknown>>(sql: string, params?: Param[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: Param[]): Promise<T | undefined>;
  run(sql: string, params?: Param[]): Promise<{ changes: number }>;
  /** Mehrere Anweisungen ohne Parameter (DDL, Migrationen). */
  exec(sql: string): Promise<void>;
  /** Transaktion. Verschachtelte Aufrufe laufen in der äußeren Transaktion mit. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Platzhalter `?` in `$n` umwandeln. Zeichen in einfachen Anführungszeichen bleiben unverändert. */
export function toPgPlaceholders(sql: string): string {
  let out = "";
  let n = 0;
  let inString = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") inString = !inString;
    if (ch === "?" && !inString) {
      out += `$${++n}`;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Booleans als 1/0, undefined als NULL: einheitlich für alle Treiber. */
export const normalizeParams = (params: Param[] = []) =>
  params.map((p) => (p === undefined ? null : typeof p === "boolean" ? (p ? 1 : 0) : p));
