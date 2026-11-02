import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { LANGUAGES, LANG_CODES, type LangCode } from "@vochat/shared";
import { admin, ApiError, type AdminFilter, type AdminStats, type AdminUser, type MailStatus } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { Empty } from "../components/ui";
import { IconClose, IconPlus, IconSearch, IconShield } from "../components/icons";
import { useSession } from "../session";

const PAGE = 25;

const roleLabel = (r: { role: string; lang: string }) =>
  r.role === "admin" ? "Admin" : `Experte ${LANGUAGES[r.lang as LangCode]?.name ?? r.lang}`;

const date = (ms: number | null) => (ms ? new Date(ms).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–");

const ERRORS: Record<string, string> = {
  "cannot remove the last admin": "Der letzte aktive Admin kann nicht entfernt werden.",
  "cannot disable yourself": "Du kannst dich nicht selbst sperren.",
  "cannot delete yourself": "Du kannst dein eigenes Konto hier nicht löschen.",
  "mail not configured": "Der Mailversand ist auf dem Server nicht eingerichtet.",
  "mail failed": "Die Mail konnte nicht verschickt werden – siehe Server-Log.",
  "account disabled": "Das Konto ist gesperrt.",
  "expert needs a language": "Für Experten bitte eine Sprache wählen.",
};
const errorText = (err: unknown) =>
  err instanceof ApiError ? (err.status === 0 ? "Keine Verbindung zum Server." : (ERRORS[err.message] ?? `Fehler: ${err.message}`)) : "Das hat nicht geklappt.";

/** Verwaltung für Admins: Nutzer, Rollen, Sperren und Mailversand. */
export function AdminPage() {
  const { token, user } = useSession();
  const isAdmin = user.roles?.some((r) => r.role === "admin") ?? false;
  const [tab, setTab] = useState<"users" | "mail">("users");
  const [stats, setStats] = useState<AdminStats | null>(null);

  const reloadStats = useCallback(() => {
    if (token && isAdmin) admin.stats(token).then(setStats).catch(() => undefined);
  }, [token, isAdmin]);
  useEffect(reloadStats, [reloadStats]);

  if (!token || !isAdmin) {
    return (
      <div className="stack">
        <PageHeader icon={<IconShield size={22} />} title="Verwaltung" />
        <div className="card stack">
          <div className="muted">
            {token ? "Diese Seite ist nur für Admins." : "Bitte melde dich mit einem Admin-Konto an."}
          </div>
          <Link to="/profile">Zum Profil</Link>
        </div>
      </div>
    );
  }

  const expertCount = stats ? Object.values(stats.experts).reduce((a, b) => a + b, 0) : null;
  return (
    <div className="stack">
      <PageHeader icon={<IconShield size={22} />} title="Verwaltung" subtitle="Nutzer, Rollen und E-Mail-Versand" />
      <div className="tiles">
        <Tile label="Nutzer" value={stats?.users} hint={stats ? `${stats.newLast7Days} neu in 7 Tagen` : undefined} accent />
        <Tile label="Admins" value={stats?.admins} />
        <Tile
          label="Experten"
          value={expertCount}
          hint={stats ? Object.entries(stats.experts).map(([l, n]) => `${LANGUAGES[l as LangCode]?.name ?? l} ${n}`).join(" · ") || "noch keine" : undefined}
        />
        <Tile label="Gesperrt" value={stats?.disabled} />
        <Tile label="E-Mail" value={stats ? (stats.mail.enabled ? "an" : "aus") : undefined} hint={stats?.mail.driver ?? "kein Versandweg"} />
      </div>
      <div className="segmented" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "users"} className={tab === "users" ? "on" : ""} onClick={() => setTab("users")}>Nutzer & Rollen</button>
        <button type="button" role="tab" aria-selected={tab === "mail"} className={tab === "mail" ? "on" : ""} onClick={() => setTab("mail")}>E-Mail</button>
      </div>
      {tab === "users" ? (
        <Users token={token} selfId={user.id} mailEnabled={stats?.mail.enabled ?? false} onChange={reloadStats} />
      ) : (
        <Mail token={token} defaultTo={user.email} />
      )}
    </div>
  );
}

function Tile({ label, value, hint, accent }: { label: string; value: number | string | null | undefined; hint?: string; accent?: boolean }) {
  return (
    <div className={`tile ${accent ? "accent" : ""}`}>
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value ?? "…"}</span>
      {hint && <span className="tile-hint">{hint}</span>}
    </div>
  );
}

function Users({ token, selfId, mailEnabled, onChange }: { token: string; selfId: string; mailEnabled: boolean; onChange: () => void }) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AdminFilter>("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Suche leicht verzögert, damit nicht jeder Tastendruck eine Anfrage auslöst.
  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    setUsers(null);
    admin
      .users(token, { q: query, filter, limit: PAGE })
      .then((r) => {
        if (!alive) return;
        setUsers(r.users);
        setTotal(r.total);
        setError(null);
      })
      .catch((err) => alive && setError(errorText(err)));
    return () => {
      alive = false;
    };
  }, [token, query, filter]);

  const more = async () => {
    try {
      const r = await admin.users(token, { q: query, filter, limit: PAGE, offset: users?.length ?? 0 });
      setUsers((prev) => [...(prev ?? []), ...r.users]);
      setTotal(r.total);
    } catch (err) {
      setError(errorText(err));
    }
  };

  const replace = (next: AdminUser) => {
    setUsers((prev) => prev?.map((u) => (u.id === next.id ? next : u)) ?? null);
    onChange();
  };
  const drop = (id: string) => {
    setUsers((prev) => prev?.filter((u) => u.id !== id) ?? null);
    setTotal((n) => n - 1);
    onChange();
  };

  return (
    <div className="stack">
      <div className="card admin-toolbar">
        <label className="admin-search">
          <IconSearch size={18} aria-hidden />
          <input type="search" placeholder="Name oder E-Mail suchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Nutzer suchen" />
        </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value as AdminFilter)} aria-label="Filter">
          <option value="">Alle Nutzer</option>
          <option value="admin">Admins</option>
          <option value="expert">Experten</option>
          <option value="disabled">Gesperrt</option>
        </select>
      </div>
      {error && <div className="error" role="alert">{error}</div>}
      {users === null ? (
        <div className="muted">Lade …</div>
      ) : users.length === 0 ? (
        <Empty>Keine Nutzer gefunden.</Empty>
      ) : (
        <>
          <div className="muted small">{total} Nutzer{query || filter ? " gefunden" : " insgesamt"}</div>
          <ul className="list">
            {users.map((u) => (
              <UserRow key={u.id} token={token} user={u} self={u.id === selfId} mailEnabled={mailEnabled} onUpdate={replace} onDelete={drop} />
            ))}
          </ul>
          {users.length < total && (
            <button type="button" onClick={more}>Mehr laden ({total - users.length} weitere)</button>
          )}
        </>
      )}
    </div>
  );
}

function UserRow({
  token,
  user,
  self,
  mailEnabled,
  onUpdate,
  onDelete,
}: {
  token: string;
  user: AdminUser;
  self: boolean;
  mailEnabled: boolean;
  onUpdate: (u: AdminUser) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<"expert" | "admin">("expert");
  const [lang, setLang] = useState<LangCode>(LANG_CODES.find((l) => l !== user.nativeLang) ?? "fa");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const run = async (fn: () => Promise<void>, success?: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      if (success) setMsg({ text: success });
    } catch (err) {
      setMsg({ text: errorText(err), error: true });
    } finally {
      setBusy(false);
    }
  };

  const grant = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await admin.grantRole(token, user.id, role, role === "expert" ? lang : null);
      onUpdate({ ...user, roles: r.roles });
    }, "Rolle vergeben.");
  };
  const revoke = (r: { role: string; lang: string }) => {
    if (!window.confirm(`Rolle „${roleLabel(r)}“ von ${user.name} entfernen?`)) return;
    void run(async () => {
      const next = await admin.revokeRole(token, user.id, r.role, r.role === "expert" ? r.lang : null);
      onUpdate({ ...user, roles: next.roles });
    });
  };
  const toggleDisabled = () => {
    const disable = user.disabledAt === null;
    if (disable && !window.confirm(`${user.name} sperren? Alle Sitzungen werden sofort beendet.`)) return;
    void run(async () => onUpdate(await admin.update(token, user.id, { disabled: disable })), disable ? "Konto gesperrt." : "Konto entsperrt.");
  };
  const remove = () => {
    const typed = window.prompt(`Konto von ${user.name} endgültig löschen? Alle Daten (Wortschatz, Chats, Beiträge) gehen verloren.\n\nZum Bestätigen die E-Mail-Adresse eingeben:`);
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== user.email) {
      setMsg({ text: "E-Mail stimmt nicht überein – nichts gelöscht.", error: true });
      return;
    }
    void run(async () => {
      await admin.remove(token, user.id);
      onDelete(user.id);
    });
  };
  const resetLink = () =>
    void run(async () => {
      await admin.sendPasswordReset(token, user.id);
    }, `Link zum Zurücksetzen an ${user.email} geschickt.`);

  return (
    <li className={`card stack admin-user ${user.disabledAt ? "is-disabled" : ""}`}>
      <div className="admin-user-head">
        <div className="admin-user-main">
          <div className="row">
            <Link to={`/users/${user.id}`}><b>{user.name}</b></Link>
            {self && <span className="badge subtle">du</span>}
            {user.disabledAt && <span className="badge danger-badge">gesperrt</span>}
          </div>
          <div className="muted small admin-email">{user.email}</div>
          <div className="muted small">
            Registriert {date(user.createdAt)} · Letzte Anmeldung {date(user.lastLoginAt)} · Muttersprache {LANGUAGES[user.nativeLang]?.name ?? user.nativeLang}
          </div>
        </div>
        <button type="button" className="small-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? "Schließen" : "Bearbeiten"}
        </button>
      </div>
      <div className="chips">
        {user.roles.length === 0 && <span className="muted small">keine Rollen</span>}
        {user.roles.map((r) => (
          <span key={`${r.role}-${r.lang}`} className="badge role-badge">
            {roleLabel(r)}
            {open && (
              <button type="button" className="chip-x" aria-label={`${roleLabel(r)} entfernen`} disabled={busy} onClick={() => revoke(r)}>
                <IconClose size={13} />
              </button>
            )}
          </span>
        ))}
      </div>
      {open && (
        <div className="stack admin-user-edit">
          <form className="admin-role-form" onSubmit={grant}>
            <select value={role} onChange={(e) => setRole(e.target.value as "expert" | "admin")} aria-label="Rolle">
              <option value="expert">Experte</option>
              <option value="admin">Admin</option>
            </select>
            {role === "expert" && (
              <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)} aria-label="Sprache">
                {LANG_CODES.map((l) => <option key={l} value={l}>{LANGUAGES[l].name}</option>)}
              </select>
            )}
            <button className="primary" disabled={busy}><IconPlus size={16} aria-hidden /> Rolle vergeben</button>
          </form>
          <div className="row">
            {mailEnabled && (
              <button type="button" className="small-btn" disabled={busy || user.disabledAt !== null} onClick={resetLink}>Passwort-Link senden</button>
            )}
            {!self && (
              <button type="button" className={`small-btn ${user.disabledAt ? "" : "danger"}`} disabled={busy} onClick={toggleDisabled}>
                {user.disabledAt ? "Entsperren" : "Sperren"}
              </button>
            )}
            {!self && <button type="button" className="small-btn danger" disabled={busy} onClick={remove}>Löschen</button>}
          </div>
        </div>
      )}
      {msg && <div className={`small ${msg.error ? "error" : "muted"}`} role="status">{msg.text}</div>}
    </li>
  );
}

function Mail({ token, defaultTo }: { token: string; defaultTo: string }) {
  const [status, setStatus] = useState<(MailStatus & { publicUrl: string }) | null>(null);
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);

  useEffect(() => {
    admin.mail(token).then(setStatus).catch((err) => setMsg({ text: errorText(err), error: true }));
  }, [token]);

  const verify = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await admin.verifyMail(token);
      setMsg(r.ok ? { text: "Verbindung zum Mailserver funktioniert." } : { text: `Verbindung fehlgeschlagen: ${r.error}`, error: true });
    } catch (err) {
      setMsg({ text: errorText(err), error: true });
    } finally {
      setBusy(false);
    }
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await admin.testMail(token, to);
      setMsg({ text: `Testmail an ${to} verschickt.` });
    } catch (err) {
      setMsg({ text: errorText(err), error: true });
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <div className="muted">{msg?.text ?? "Lade …"}</div>;
  return (
    <div className="stack">
      <section className="card stack">
        <h2>Versand</h2>
        <dl className="admin-facts">
          <dt>Status</dt>
          <dd>{status.enabled ? <span className="badge linked">eingerichtet</span> : <span className="badge subtle">aus</span>}</dd>
          <dt>Versandweg</dt>
          <dd>{status.driver ?? "–"}</dd>
          <dt>Absender</dt>
          <dd>{status.from ?? "–"}</dd>
          <dt>Links zeigen auf</dt>
          <dd>{status.publicUrl}</dd>
        </dl>
        {status.enabled ? (
          <div className="row">
            <button type="button" className="small-btn" disabled={busy} onClick={verify}>Verbindung prüfen</button>
          </div>
        ) : (
          <div className="muted small">
            Ohne Mailversand funktionieren „Passwort vergessen“ und Benachrichtigungen nicht. Einrichten über Umgebungsvariablen
            des Backends, z. B. <code>MAIL_DRIVER=smtp</code> mit <code>SMTP_HOST</code>, <code>SMTP_USER</code>, <code>SMTP_PASS</code> –
            oder <code>MAIL_DRIVER=gmail</code> mit <code>GMAIL_USER</code> und <code>GMAIL_APP_PASSWORD</code>. Details in der README.
          </div>
        )}
      </section>
      {status.enabled && (
        <form className="card stack" onSubmit={send}>
          <h2>Testmail</h2>
          <label>
            Empfänger
            <input type="email" required value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button className="primary" disabled={busy}>{busy ? "…" : "Testmail senden"}</button>
        </form>
      )}
      {msg && <div className={msg.error ? "error" : "muted"} role="status">{msg.text}</div>}
    </div>
  );
}
