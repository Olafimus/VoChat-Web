import type { Context, MiddlewareHandler } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

/**
 * Einfache Ratenbegrenzung im Speicher (festes Zeitfenster je Client). Für eine Instanz
 * ausreichend; bei mehreren Instanzen gehört das in einen gemeinsamen Speicher (z. B. Redis).
 * Hinter einem Proxy (nginx im Docker-Setup) liefert `X-Real-IP` die Client-Adresse – nur
 * vertrauen, wenn TRUST_PROXY gesetzt ist, sonst lässt sich der Header fälschen.
 */
export function rateLimit(opts: { windowMs: number; max: number; trustProxy: boolean; name: string }): MiddlewareHandler {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return async (c, next) => {
    const now = Date.now();
    const key = `${opts.name}:${clientIp(c, opts.trustProxy)}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(key, bucket);
      if (buckets.size > 50_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    bucket.count++;
    if (bucket.count > opts.max) {
      c.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return c.json({ error: "too many requests" }, 429);
    }
    await next();
  };
}

function clientIp(c: Context, trustProxy: boolean): string {
  if (trustProxy) {
    const real = c.req.header("x-real-ip");
    if (real) return real;
  }
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown"; // z. B. in Tests ohne echte Verbindung
  }
}
