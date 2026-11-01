export interface Config {
  port: number;
  dbPath: string;
  corsOrigins: string[];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: Number(env.PORT ?? 8787),
    dbPath: env.DB_PATH ?? "data/vochat.db",
    corsOrigins: (env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((s) => s.trim()).filter(Boolean),
  };
}
