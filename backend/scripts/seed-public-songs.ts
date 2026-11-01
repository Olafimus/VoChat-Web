/**
 * Legt die gemeinfreien Lied-Sammlungen als öffentliche Medien-Sammlungen an.
 * Eigentümer ist ein System-Konto ohne Anmeldung. Ausführen: npm run seed:songs
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, transaction } from "../src/db.js";

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(here, "..");
const seed = JSON.parse(readFileSync(join(backendDir, "data", "seeds", "public-songs-ja.json"), "utf8")) as {
  collections: { id: string; title: string; mediaType: string; description: string; level: string; items: { lemma: string; gloss: string }[] }[];
};
const SYSTEM_ID = "system-vochat";
const db = openDb(resolve(backendDir, process.env.DB_PATH ?? "data/vochat.db"));
const now = Date.now();

transaction(db, () => {
  // Systemkonto: kein gültiges Passwort-Hash-Format, daher keine Anmeldung möglich.
  db.prepare(
    `INSERT INTO users (id, email, name, password_hash, native_lang, created_at, profile_public)
     VALUES (?, 'system@vochat.invalid', 'VoChat', 'disabled', 'de', ?, 1)
     ON CONFLICT (id) DO NOTHING`,
  ).run(SYSTEM_ID, now);

  for (const c of seed.collections) {
    const row = {
      id: c.id,
      kind: "media",
      mediaType: c.mediaType,
      title: c.title,
      description: c.description,
      lang: "ja",
      level: c.level,
      visibility: "public",
      ownerName: "VoChat",
      items: c.items.map((i) => ({ lemma: i.lemma, lang: "ja", lexemeId: null, gloss: i.gloss, cefr: null })),
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };
    db.prepare(
      `INSERT INTO sync_rows (user_id, entity, id, data, updated_at, deleted, seq)
       VALUES (?, 'collections', ?, ?, ?, 0, (SELECT value FROM counters WHERE name = 'seq') + 1)
       ON CONFLICT (user_id, entity, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    ).run(SYSTEM_ID, c.id, JSON.stringify(row), now);
    db.exec("UPDATE counters SET value = value + 1 WHERE name = 'seq'");
  }
});
console.log(`${seed.collections.length} Sammlungen angelegt.`);
db.close();
