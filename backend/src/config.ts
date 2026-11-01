export interface Config {
  port: number;
  dbPath: string;
  corsOrigins: string[];
  adminEmails: string[];
  verifyThreshold: number;
  rejectThreshold: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8787),
    dbPath: env.DB_PATH ?? "data/vochat.db",
    corsOrigins: (env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
    adminEmails: (env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    verifyThreshold: Number(env.COMMUNITY_VERIFY_THRESHOLD ?? 3),
    rejectThreshold: Number(env.COMMUNITY_REJECT_THRESHOLD ?? 3),
  };
}
