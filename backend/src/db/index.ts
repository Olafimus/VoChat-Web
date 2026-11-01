import { migrate } from "./migrate.js";
import type { Db } from "./types.js";

export type { Db, Dialect, Param } from "./types.js";
export { migrate } from "./migrate.js";

/**
 * Öffnet die Datenbank und bringt das Schema auf den neuesten Stand.
 * - `postgres://…` / `postgresql://…`: Postgres-Server (Produktion, Docker)
 * - `pglite:` bzw. `pglite:/pfad`: Postgres im Prozess (Tests, Entwicklung)
 * - sonst: SQLite-Datei (`:memory:` für Tests)
 * Treiber werden erst bei Bedarf geladen.
 */
export async function openDatabase(target: string): Promise<Db> {
  let db: Db;
  if (/^postgres(ql)?:\/\//.test(target)) db = (await import("./postgres.js")).openPostgres(target);
  else if (target.startsWith("pglite:")) db = await (await import("./pglite.js")).openPglite(target.slice("pglite:".length) || undefined);
  else db = (await import("./sqlite.js")).openSqlite(target);
  await migrate(db);
  return db;
}
