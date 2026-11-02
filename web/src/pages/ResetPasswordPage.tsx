import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { IconShield } from "../components/icons";

/** Ziel des Links aus der Mail „Passwort zurücksetzen“. */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== repeat) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 0
          ? "Keine Verbindung zum Server."
          : err instanceof ApiError && err.status === 429
            ? "Zu viele Versuche – bitte warte ein paar Minuten."
            : "Der Link ist ungültig oder abgelaufen. Fordere bitte einen neuen an.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack narrow">
      <PageHeader icon={<IconShield size={22} />} title="Neues Passwort" />
      <div className="card stack">
        {!token ? (
          <div className="muted">Dieser Link ist unvollständig. Öffne ihn bitte direkt aus der E-Mail.</div>
        ) : done ? (
          <>
            <div>Dein Passwort wurde geändert. Aus Sicherheitsgründen wurdest du auf allen Geräten abgemeldet.</div>
            <Link to="/profile" className="button primary">Jetzt anmelden</Link>
          </>
        ) : (
          <form className="stack" onSubmit={submit}>
            <label>
              Neues Passwort <span className="muted small">(mind. 8 Zeichen)</span>
              <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </label>
            <label>
              Wiederholen
              <input type="password" required minLength={8} value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
            </label>
            {error && <div className="error" role="alert">{error}</div>}
            <button className="primary" disabled={busy}>{busy ? "…" : "Passwort speichern"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
