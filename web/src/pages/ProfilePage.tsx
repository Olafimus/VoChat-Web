import { useState, type FormEvent } from "react";
import { CEFR_LEVELS, LANGUAGES, LANG_CODES, type Cefr, type LangCode, type UserProfile } from "@vochat/shared";
import { api, ApiError } from "../api/client";
import { useSession } from "../session";

export function ProfilePage() {
  const { token, user, setUser, logout, engine } = useSession();
  const [name, setName] = useState(user.name);
  const [nativeLang, setNativeLang] = useState<LangCode>(user.nativeLang);
  const [learn, setLearn] = useState<{ lang: LangCode; targetCefr: Cefr | null }[]>(user.learnLangs);
  const [saved, setSaved] = useState<string | null>(null);

  const toggle = (lang: LangCode) => {
    setLearn((prev) =>
      prev.some((l) => l.lang === lang) ? prev.filter((l) => l.lang !== lang) : [...prev, { lang, targetCefr: "B1" }],
    );
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaved(null);
    try {
      const profile: UserProfile = await api.updateProfile(token, { name, nativeLang, learnLangs: learn });
      setUser(profile);
      setSaved("Gespeichert.");
    } catch (err) {
      setSaved(err instanceof ApiError && err.status === 0 ? "Offline – nicht gespeichert." : "Speichern fehlgeschlagen.");
    }
  };

  return (
    <form className="card stack" onSubmit={save}>
      <h2>Profil</h2>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Muttersprache
        <select value={nativeLang} onChange={(e) => setNativeLang(e.target.value as LangCode)}>
          {LANG_CODES.map((l) => (
            <option key={l} value={l}>{LANGUAGES[l].nativeName}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Sprachen, die ich lerne</legend>
        {LANG_CODES.filter((l) => l !== nativeLang).map((l) => {
          const entry = learn.find((x) => x.lang === l);
          return (
            <div key={l} className="row">
              <label className="inline">
                <input type="checkbox" checked={!!entry} onChange={() => toggle(l)} /> {LANGUAGES[l].name}
              </label>
              {entry && (
                <select
                  value={entry.targetCefr ?? ""}
                  onChange={(e) =>
                    setLearn((prev) => prev.map((x) => (x.lang === l ? { ...x, targetCefr: (e.target.value || null) as Cefr | null } : x)))
                  }
                  aria-label={`Ziel-Niveau ${LANGUAGES[l].name}`}
                >
                  <option value="">kein Ziel</option>
                  {CEFR_LEVELS.map((c) => (
                    <option key={c} value={c}>Ziel {c}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </fieldset>
      {saved && <div className="muted small" role="status">{saved}</div>}
      <div className="row">
        <button className="primary">Speichern</button>
        <span className="spacer" />
        <span className="muted small">{engine.getStatus().pending} Änderungen warten auf Sync</span>
        <button type="button" className="danger" onClick={logout}>Abmelden</button>
      </div>
    </form>
  );
}
