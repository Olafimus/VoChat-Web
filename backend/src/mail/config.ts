import { ConsoleMailAdapter, gmailAdapter, smtpAdapter, type MailAdapter } from "./adapters.js";

export interface MailConfig {
  /** none | console | smtp | gmail – oder ein selbst registrierter Treiber. */
  driver: string;
  /** Absender, z. B. "VoChat <noreply@example.com>". */
  from: string;
  replyTo?: string;
  smtp: { host?: string; port: number; secure: boolean; user?: string; pass?: string; allowSelfSigned: boolean };
  gmail: { user?: string; appPassword?: string; clientId?: string; clientSecret?: string; refreshToken?: string };
}

const bool = (v: string | undefined) => v === "1" || v === "true";

export function loadMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const port = Number(env.SMTP_PORT ?? 587);
  return {
    driver: (env.MAIL_DRIVER ?? "none").trim().toLowerCase(),
    from: env.MAIL_FROM || (env.GMAIL_USER ? `VoChat <${env.GMAIL_USER}>` : "VoChat <noreply@localhost>"),
    replyTo: env.MAIL_REPLY_TO || undefined,
    smtp: {
      host: env.SMTP_HOST || undefined,
      port,
      secure: env.SMTP_SECURE !== undefined ? bool(env.SMTP_SECURE) : port === 465,
      user: env.SMTP_USER || undefined,
      pass: env.SMTP_PASS || undefined,
      allowSelfSigned: bool(env.SMTP_ALLOW_SELF_SIGNED),
    },
    gmail: {
      user: env.GMAIL_USER || undefined,
      appPassword: env.GMAIL_APP_PASSWORD || undefined,
      clientId: env.GMAIL_CLIENT_ID || undefined,
      clientSecret: env.GMAIL_CLIENT_SECRET || undefined,
      refreshToken: env.GMAIL_REFRESH_TOKEN || undefined,
    },
  };
}

export type MailDriverFactory = (config: MailConfig) => Promise<MailAdapter | null>;

/**
 * Verfügbare Versandwege. Weitere (z. B. eine HTTP-API wie Resend oder SES) lassen sich mit
 * `registerMailDriver` ergänzen, ohne den Rest der App anzufassen.
 */
const drivers = new Map<string, MailDriverFactory>([
  ["none", async () => null],
  ["console", async () => new ConsoleMailAdapter()],
  [
    "smtp",
    async (c) => {
      if (!c.smtp.host) throw new Error("MAIL_DRIVER=smtp braucht SMTP_HOST");
      return smtpAdapter({ ...c.smtp, host: c.smtp.host });
    },
  ],
  [
    "gmail",
    async ({ gmail: g }) => {
      if (!g.user) throw new Error("MAIL_DRIVER=gmail braucht GMAIL_USER");
      if (g.appPassword) return gmailAdapter({ user: g.user, appPassword: g.appPassword });
      if (g.clientId && g.clientSecret && g.refreshToken) {
        return gmailAdapter({ user: g.user, clientId: g.clientId, clientSecret: g.clientSecret, refreshToken: g.refreshToken });
      }
      throw new Error("MAIL_DRIVER=gmail braucht GMAIL_APP_PASSWORD oder GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN");
    },
  ],
]);

export function registerMailDriver(name: string, factory: MailDriverFactory): void {
  drivers.set(name.toLowerCase(), factory);
}

export const mailDrivers = () => [...drivers.keys()];

export async function createMailAdapter(config: MailConfig): Promise<MailAdapter | null> {
  const factory = drivers.get(config.driver);
  if (!factory) throw new Error(`MAIL_DRIVER unbekannt: ${config.driver} (möglich: ${mailDrivers().join(", ")})`);
  return factory(config);
}
