/**
 * Legt die gemeinfreien Lied-Sammlungen als öffentliche Medien-Sammlungen an.
 * Gespeichert werden nur die vorkommenden Wörter mit Bedeutung – keine Liedtexte.
 * Eigentümer ist ein System-Konto ohne Anmeldung. Ausführen: npm run seed:songs
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectionSchema } from "@vochat/shared";
import { openDatabase } from "../src/db/index.js";
import { syncPublicCollection } from "../src/sync.js";

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(here, "..");
const seed = JSON.parse(readFileSync(join(backendDir, "data", "seeds", "public-songs-ja.json"), "utf8")) as {
  collections: { id: string; title: string; mediaType: string; description: string; level: string; items: { lemma: string; gloss: string; pronunciation?: string }[] }[];
};
const SYSTEM_ID = "system-vochat";
const target = process.env.DATABASE_URL ?? process.env.DB_PATH ?? "data/vochat.db";
const db = await openDatabase(/^(postgres|pglite:)/.test(target) ? target : resolve(backendDir, target));
const now = Date.now();

await db.tx(async (t) => {
  // Systemkonto: Passwort-Hash im ungültigen Format, Anmeldung daher unmöglich.
  await t.run(
    `INSERT INTO users (id, email, name, password_hash, native_lang, created_at, profile_public)
     VALUES (?, 'system@vochat.invalid', 'VoChat', 'disabled', 'de', ?, 1) ON CONFLICT (id) DO NOTHING`,
    [SYSTEM_ID, now],
  );
  for (const c of seed.collections) {
    const row = collectionSchema.parse({
      id: c.id,
      kind: "media",
      mediaType: c.mediaType,
      title: c.title,
      description: c.description,
      lang: "ja",
      level: c.level,
      visibility: "public",
      ownerName: "VoChat",
      items: c.items.map((i) => ({ lemma: i.lemma, lang: "ja", lexemeId: null, gloss: i.gloss, pronunciation: i.pronunciation ?? null, cefr: null })),
      createdAt: now,
      updatedAt: now,
      deleted: false,
    });
    const seq = (await t.get<{ value: number }>("UPDATE counters SET value = value + 1 WHERE name = 'seq' RETURNING value"))!.value;
    await t.run(
      `INSERT INTO sync_rows (user_id, entity, id, data, attr, updated_at, deleted, seq) VALUES (?, 'collections', ?, ?, NULL, ?, 0, ?)
       ON CONFLICT (user_id, entity, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, seq = excluded.seq`,
      [SYSTEM_ID, c.id, JSON.stringify(row), now, seq],
    );
    await syncPublicCollection(t, SYSTEM_ID, row);
  }
});
console.log(`${seed.collections.length} Sammlungen angelegt.`);
await db.close();
