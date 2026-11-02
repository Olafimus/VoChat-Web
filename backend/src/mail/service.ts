import type { MailAdapter } from "./adapters.js";
import { LANGUAGES, type LangCode } from "@vochat/shared";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

export interface MailServiceOptions {
  from?: string;
  replyTo?: string;
  /** Öffentliche Adresse der Web-App für Links in Mails (ohne Schrägstrich am Ende). */
  publicUrl?: string;
  appName?: string;
  log?: (message: string) => void;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/**
 * Versand von E-Mails über einen austauschbaren Adapter, dazu die Vorlagen der App.
 * Ohne Adapter ist der Dienst ausgeschaltet: Senden liefert `{ ok: false }`, nichts wirft.
 */
export class MailService {
  readonly from: string;
  readonly publicUrl: string;
  private readonly appName: string;
  private readonly replyTo?: string;
  private readonly log: (message: string) => void;
  private readonly pending = new Set<Promise<unknown>>();

  constructor(
    private readonly adapter: MailAdapter | null,
    o: MailServiceOptions = {},
  ) {
    this.from = o.from ?? "VoChat <noreply@localhost>";
    this.replyTo = o.replyTo;
    this.publicUrl = (o.publicUrl ?? "http://localhost:5173").replace(/\/+$/, "");
    this.appName = o.appName ?? "VoChat";
    this.log = o.log ?? ((m) => console.error(m));
  }

  get enabled(): boolean {
    return this.adapter !== null;
  }

  get driver(): string | null {
    return this.adapter?.name ?? null;
  }

  status() {
    return { enabled: this.enabled, driver: this.driver, from: this.enabled ? this.from : null };
  }

  /** Verschickt eine Nachricht. Fehler werden protokolliert und als Ergebnis gemeldet. */
  async send(message: MailMessage): Promise<SendResult> {
    if (!this.adapter) return { ok: false, error: "mail disabled" };
    try {
      await this.adapter.send({ ...message, from: this.from, replyTo: this.replyTo });
      return { ok: true };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      this.log(`[mail] Versand an ${message.to} fehlgeschlagen (${this.adapter.name}): ${error}`);
      return { ok: false, error };
    }
  }

  /** Im Hintergrund senden (die Anfrage wartet nicht auf den Mailserver). */
  sendLater(message: MailMessage): void {
    if (!this.adapter) return;
    const p = this.send(message).finally(() => this.pending.delete(p));
    this.pending.add(p);
  }

  /** Wartet auf alle Hintergrund-Sendungen (Tests, Herunterfahren). */
  async idle(): Promise<void> {
    while (this.pending.size) await Promise.all([...this.pending]);
  }

  async verify(): Promise<SendResult> {
    if (!this.adapter) return { ok: false, error: "mail disabled" };
    try {
      await this.adapter.verify?.();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async close(): Promise<void> {
    await this.idle();
    await this.adapter?.close?.();
  }

  link(path: string): string {
    return this.publicUrl + (path.startsWith("/") ? path : `/${path}`);
  }

  // ---- Vorlagen ------------------------------------------------------------

  /** Einheitlicher Rahmen: Klartext und schlichtes HTML aus Absätzen und optionalem Knopf. */
  compose(to: string, subject: string, paragraphs: string[], action?: { label: string; url: string }): MailMessage {
    const text = [...paragraphs, ...(action ? [`${action.label}: ${action.url}`] : []), `– ${this.appName}`].join("\n\n");
    const button = action
      ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#6d4aff;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>
<p style="color:#666;font-size:13px">Falls der Knopf nicht funktioniert: ${escapeHtml(action.url)}</p>`
      : "";
    const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.5;color:#222;max-width:560px;margin:0 auto;padding:24px">
<h2 style="margin:0 0 16px">${escapeHtml(this.appName)}</h2>
${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n")}
${button}
</body></html>`;
    return { to, subject, text, html };
  }

  welcome(to: string, name: string): MailMessage {
    return this.compose(
      to,
      `Willkommen bei ${this.appName}`,
      [`Hallo ${name},`, `schön, dass du dabei bist! Dein Konto ist eingerichtet und deine Daten werden ab jetzt zwischen deinen Geräten synchronisiert.`],
      { label: `${this.appName} öffnen`, url: this.link("/") },
    );
  }

  passwordReset(to: string, name: string, token: string, validMinutes: number): MailMessage {
    return this.compose(
      to,
      "Passwort zurücksetzen",
      [
        `Hallo ${name},`,
        `jemand (hoffentlich du) möchte das Passwort für dein Konto zurücksetzen. Der Link ist ${validMinutes} Minuten gültig und funktioniert nur einmal.`,
        "Wenn du das nicht warst, kannst du diese Mail ignorieren – dein Passwort bleibt unverändert.",
      ],
      { label: "Neues Passwort festlegen", url: this.link(`/reset-password?token=${encodeURIComponent(token)}`) },
    );
  }

  roleChanged(to: string, name: string, role: string, lang: string, granted: boolean): MailMessage {
    const label = role === "admin" ? "Admin" : `Experte für ${LANGUAGES[lang as LangCode]?.name ?? lang}`;
    return this.compose(
      to,
      granted ? `Neue Rolle: ${label}` : `Rolle entzogen: ${label}`,
      [
        `Hallo ${name},`,
        granted
          ? `dir wurde die Rolle „${label}“ zugewiesen. Danke, dass du die Community unterstützt!`
          : `die Rolle „${label}“ wurde von deinem Konto entfernt.`,
      ],
      granted ? { label: "Zur Community", url: this.link("/community") } : undefined,
    );
  }

  accountStatus(to: string, name: string, disabled: boolean): MailMessage {
    return this.compose(to, disabled ? "Dein Konto wurde gesperrt" : "Dein Konto ist wieder aktiv", [
      `Hallo ${name},`,
      disabled
        ? "dein Konto wurde von einem Admin gesperrt. Bei Fragen antworte einfach auf diese Mail."
        : "dein Konto wurde wieder freigeschaltet. Du kannst dich wie gewohnt anmelden.",
    ]);
  }

  test(to: string, by: string): MailMessage {
    return this.compose(to, `Testmail von ${this.appName}`, [
      `Diese Testmail wurde von ${by} über die Admin-Seite verschickt.`,
      `Versandweg: ${this.driver ?? "aus"} · Absender: ${this.from}`,
      "Wenn du sie liest, funktioniert der Mailversand.",
    ]);
  }
}
