import type { MediaConfig } from "./media.js";
import { loadMailConfig, type MailConfig } from "./mail/config.js";

export interface Config {
  port: number;
  /** postgres://… (Server), pglite:[pfad] (eingebettet) oder SQLite-Datei. */
  database: string;
  trustProxy: boolean;
  corsOrigins: string[];
  /** Geheimnis für signierte Links; ohne Angabe wird eines erzeugt und in der DB abgelegt. */
  appSecret: string | undefined;
  verifyThreshold: number;
  rejectThreshold: number;
  media: MediaConfig;
  /** Sprachsynthese (eSpeak NG) für Wörter ohne Aufnahme. */
  tts: boolean;
  ttsCacheDir: string | null;
  /** Öffentliche Adresse der Web-App (für Links in E-Mails). */
  publicUrl: string;
  mail: MailConfig;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const driver = (env.MEDIA_DRIVER ?? "none") as MediaConfig["driver"];
  if (!["none", "local", "s3"].includes(driver)) throw new Error(`MEDIA_DRIVER ungültig: ${driver}`);
  const corsOrigins = (env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    port: Number(env.PORT ?? 8787),
    database: env.DATABASE_URL || env.DB_PATH || "data/vochat.db",
    trustProxy: env.TRUST_PROXY === "1" || env.TRUST_PROXY === "true",
    corsOrigins,
    publicUrl: env.PUBLIC_URL || corsOrigins[0] || "http://localhost:5173",
    mail: loadMailConfig(env),
    appSecret: env.APP_SECRET || undefined,
    verifyThreshold: Number(env.COMMUNITY_VERIFY_THRESHOLD ?? 3),
    rejectThreshold: Number(env.COMMUNITY_REJECT_THRESHOLD ?? 3),
    tts: env.TTS !== "off",
    ttsCacheDir: env.TTS_CACHE_DIR === "" ? null : (env.TTS_CACHE_DIR ?? "data/tts-cache"),
    media: {
      driver,
      localDir: env.MEDIA_LOCAL_DIR ?? "data/media",
      s3Bucket: env.MEDIA_S3_BUCKET,
      s3Region: env.MEDIA_S3_REGION,
      s3Endpoint: env.MEDIA_S3_ENDPOINT,
    },
  };
}
