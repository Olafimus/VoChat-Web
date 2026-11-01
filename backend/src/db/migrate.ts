import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = resolve(here, "..", "..", "migrations");

/** Wendet alle noch fehlenden Migrationen des Dialekts an (je Datei eine Transaktion). */
export async function migrate(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at BIGINT NOT NULL)");
  const applied = new Set((await db.all<{ version: string }>("SELECT version FROM schema_migrations")).map((r) => r.version));
  const files = readdirSync(join(dir, db.dialect))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const done: string[] = [];
  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (applied.has(version)) continue;
    const sql = readFileSync(join(dir, db.dialect, file), "utf8");
    await db.tx(async (t) => {
      await t.exec(sql);
      await t.run("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)", [version, Date.now()]);
    });
    done.push(version);
  }
  return done;
}
