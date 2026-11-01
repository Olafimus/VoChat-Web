import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { openDb } from "./db.js";
import { loadConfig } from "./config.js";
import { createMediaStore } from "./media.js";

const config = loadConfig();
const db = openDb(config.dbPath);
const media = await createMediaStore(config.media);
const app = createApp({
  db,
  corsOrigins: config.corsOrigins,
  adminEmails: config.adminEmails,
  community: { verifyThreshold: config.verifyThreshold, rejectThreshold: config.rejectThreshold, maxPendingPerUser: 30 },
  media,
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`VoChat API läuft auf http://localhost:${info.port} (DB: ${config.dbPath}, Medien: ${media?.driver ?? "aus"})`);
});
