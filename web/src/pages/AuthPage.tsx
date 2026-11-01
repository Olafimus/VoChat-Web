import { useState, type FormEvent } from "react";
import { LANGUAGES, LANG_CODES, type AuthResponse, type LangCode } from "@vochat/shared";
import { api, ApiError } from "../api/client";

/** Anmelde- und Registrierungsformular. Optional: nur für die Synchronisation nötig. */
export function AuthForm({ onAuthenticated }: { onAuthenticated: (token: string, user: AuthResponse["user"]) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", password: "", name: "", nativeLang: "de" as LangCode });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = mode === "login" ? await api.login({ email: form.email, password: form.password }) : await api.register(form);
      onAuthenticated(res.token, res.user);
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 0
          ? "Keine Verbindung zum Server."
          : err instanceof ApiError && err.status === 409
            ? "Diese E-Mail ist bereits registriert."
            : err instanceof ApiError && err.status === 401
              ? "E-Mail oder Passwort falsch."
              : "Das hat nicht geklappt. Bitte prüfe deine Eingaben.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack" onSubmit={submit}>
      <div className="segmented" role="tablist">
        <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Anmelden</button>
        <button type="button" className={mode === "register" ? "on" : ""} onClick={() => setMode("register")}>Konto erstellen</button>
      </div>
      {mode === "register" && (
        <label>
          Name
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" />
        </label>
      )}
      <label>
        E-Mail
        <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
      </label>
      <label>
        Passwort {mode === "register" && <span className="muted small">(mind. 8 Zeichen)</span>}
        <input
          type="password"
          required
          minLength={mode === "register" ? 8 : 1}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />
      </label>
      {mode === "register" && (
        <label>
          Muttersprache
          <select value={form.nativeLang} onChange={(e) => setForm({ ...form, nativeLang: e.target.value as LangCode })}>
            {LANG_CODES.map((l) => (
              <option key={l} value={l}>{LANGUAGES[l].nativeName}</option>
            ))}
          </select>
        </label>
      )}
      {error && <div className="error" role="alert">{error}</div>}
      <button className="primary" disabled={busy}>{busy ? "…" : mode === "login" ? "Anmelden" : "Konto erstellen"}</button>
    </form>
  );
}
