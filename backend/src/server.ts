import { Tts } from "./tts.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { openDatabase } from "./db/index.js";
import { loadConfig } from "./config.js";
import { createMediaStore } from "./media.js";
import { backfillDerivedColumns } from "./sync.js";
import { randomBytes } from "node:crypto";
import type { Db } from "./db/index.js";
import { createMailAdapter, MailService } from "./mail/index.js";

/** Dauerhaftes Geheimnis der Installation: aus APP_SECRET oder einmalig erzeugt und in der DB gespeichert. */
async function loadAppSecret(db: Db, fromEnv: string | undefined): Promise<string> {
  if (fromEnv) return fromEnv;
  const row = await db.get<{ value: string }>("SELECT value FROM app_settings WHERE key = 'app_secret'");
  if (row) return row.value;
  const secret = randomBytes(32).toString("base64url");
  await db.run("INSERT INTO app_settings (key, value) VALUES ('app_secret', ?) ON CONFLICT (key) DO NOTHING", [secret]);
  return (await db.get<{ value: string }>("SELECT value FROM app_settings WHERE key = 'app_secret'"))!.value;
}

const config = loadConfig();
const isFile = !/^(postgres(ql)?:\/\/|pglite:)/.test(config.database) && config.database !== ":memory:";
if (isFile) mkdirSync(dirname(config.database), { recursive: true });

const db = await openDatabase(config.database);
const backfilled = await backfillDerivedColumns(db);
if (backfilled) console.log(`${backfilled} Sync-Zeilen um Auswertungs-Spalten ergänzt.`);
const media = await createMediaStore(config.media);
const mail = new MailService(await createMailAdapter(config.mail), {
  from: config.mail.from,
  replyTo: config.mail.replyTo,
  publicUrl: config.publicUrl,
});
if (mail.enabled && mail.driver !== "console") {
  // Nur prüfen und melden: ein nicht erreichbarer Mailserver soll den Start nicht verhindern.
  void mail.verify().then((r) => console.log(r.ok ? `Mailversand bereit (${mail.driver}).` : `Mailversand (${mail.driver}) nicht erreichbar: ${r.error}`));
}
const app = createApp({
  db,
  corsOrigins: config.corsOrigins,
  appSecret: await loadAppSecret(db, config.appSecret),
  community: { verifyThreshold: config.verifyThreshold, rejectThreshold: config.rejectThreshold, maxPendingPerUser: 30 },
  media,
  trustProxy: config.trustProxy,
  tts: config.tts ? new Tts(config.ttsCacheDir) : null,
  mail,
});

const label = /^postgres/.test(config.database) ? "Postgres" : config.database.startsWith("pglite:") ? "PGlite" : `SQLite (${config.database})`;
const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`VoChat API läuft auf http://localhost:${info.port} · DB: ${label} · Medien: ${media?.driver ?? "aus"} · Mail: ${mail.driver ?? "aus"}`);
});

const shutdown = async () => {
  server.close();
  await mail.close();
  await db.close();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
