import type { Transporter } from "nodemailer";

/** Eine fertige Nachricht, wie sie an einen Adapter geht. */
export interface OutgoingMail {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

/**
 * Versandweg für E-Mails. Jede Möglichkeit (eigener SMTP-Server, Gmail, Konsole, Test-Speicher …)
 * ist ein Adapter; der MailService kennt nur diese Schnittstelle.
 */
export interface MailAdapter {
  /** Kurzname für Logs und die Admin-Seite (z. B. "smtp", "gmail"). */
  readonly name: string;
  send(mail: OutgoingMail): Promise<void>;
  /** Verbindung/Anmeldung prüfen, ohne etwas zu verschicken (optional). */
  verify?(): Promise<void>;
  close?(): Promise<void> | void;
}

/** Schreibt Mails ins Server-Log – für die Entwicklung ohne Mailserver. */
export class ConsoleMailAdapter implements MailAdapter {
  readonly name = "console";
  constructor(private readonly log: (line: string) => void = console.log) {}
  async send(mail: OutgoingMail): Promise<void> {
    this.log(`[mail] an ${mail.to} · ${mail.subject}\n${mail.text}\n`);
  }
}

/** Hält verschickte Mails im Speicher – für Tests. */
export class MemoryMailAdapter implements MailAdapter {
  readonly name = "memory";
  readonly sent: OutgoingMail[] = [];
  /** Zum Testen von Fehlern: die nächste Sendung schlägt fehl. */
  failNext = false;
  async send(mail: OutgoingMail): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("simulated failure");
    }
    this.sent.push(mail);
  }
  async verify(): Promise<void> {}
}

/** Gemeinsame Hülle um einen Nodemailer-Transport (SMTP, Gmail, …). */
export class NodemailerAdapter implements MailAdapter {
  constructor(
    readonly name: string,
    private readonly transport: Transporter,
  ) {}
  async send(mail: OutgoingMail): Promise<void> {
    await this.transport.sendMail({
      from: mail.from,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      replyTo: mail.replyTo,
    });
  }
  async verify(): Promise<void> {
    await this.transport.verify();
  }
  close(): void {
    this.transport.close();
  }
}

export interface SmtpOptions {
  host: string;
  port: number;
  /** TLS ab Verbindungsbeginn (Port 465). Sonst STARTTLS, falls der Server es anbietet. */
  secure: boolean;
  user?: string;
  pass?: string;
  /** Selbstsignierte Zertifikate erlauben (nur für interne Server). */
  allowSelfSigned?: boolean;
}

/** Eigener SMTP-Server (Postfix, Mailcow, Mailgun-/SES-/Brevo-SMTP, Mailpit …). */
export async function smtpAdapter(o: SmtpOptions): Promise<MailAdapter> {
  const nodemailer = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: o.host,
    port: o.port,
    secure: o.secure,
    auth: o.user ? { user: o.user, pass: o.pass ?? "" } : undefined,
    tls: o.allowSelfSigned ? { rejectUnauthorized: false } : undefined,
    // Keine Dateien/URLs als Anhänge nachladen: Inhalte kommen nur aus unseren Vorlagen.
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return new NodemailerAdapter("smtp", transport);
}

export type GmailOptions =
  | { user: string; appPassword: string }
  | { user: string; clientId: string; clientSecret: string; refreshToken: string };

/**
 * Gmail / Google Workspace über Nodemailer.
 * - App-Passwort (Konto mit 2-Faktor-Anmeldung → „App-Passwörter“), oder
 * - OAuth2 mit Client-ID, Client-Secret und Refresh-Token (Google Cloud Console, Gmail-Scope).
 */
export async function gmailAdapter(o: GmailOptions): Promise<MailAdapter> {
  const nodemailer = await import("nodemailer");
  const auth =
    "appPassword" in o
      ? { user: o.user, pass: o.appPassword }
      : { type: "OAuth2" as const, user: o.user, clientId: o.clientId, clientSecret: o.clientSecret, refreshToken: o.refreshToken };
  const transport = nodemailer.createTransport({
    service: "gmail",
    auth,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  return new NodemailerAdapter("gmail", transport);
}
