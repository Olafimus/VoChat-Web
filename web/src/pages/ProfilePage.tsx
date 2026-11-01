import { useEffect, useState, type FormEvent } from "react";
import { CEFR_LEVELS, LANGUAGES, LANG_CODES, type Cefr, type LangCode } from "@vochat/shared";
import { api, ApiError, media } from "../api/client";
import { Avatar } from "../components/Avatar";
import { useSession, useSyncStatus } from "../session";
import { AuthForm } from "./AuthPage";

export function ProfilePage() {
  const { user, token, updateProfile, replaceProfile, connect, disconnect, collections } = useSession();
  const [bio, setBio] = useState(user.bio);
  const [profilePublic, setProfilePublic] = useState(user.profilePublic);
  const [showProgress, setShowProgress] = useState(user.showProgress);
  const [avatarOn, setAvatarOn] = useState<boolean | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);

  useEffect(() => {
    media.features().then((f) => setAvatarOn(f.avatars)).catch(() => setAvatarOn(false));
  }, []);

  const uploadAvatar = async (file: File) => {
    if (!token) return;
    setAvatarMsg(null);
    try {
      const next = await media.uploadAvatar(token, file);
      replaceProfile(next);
      setAvatarMsg("Profilbild gespeichert.");
    } catch (err) {
      setAvatarMsg(
        err instanceof ApiError && err.status === 413 ? "Das Bild ist zu groß (max. 2 MB)."
          : err instanceof ApiError && err.status === 415 ? "Nur PNG, JPEG oder WebP."
          : err instanceof ApiError && err.status === 503 ? "Bildupload ist auf diesem Server noch nicht eingerichtet."
          : "Upload fehlgeschlagen.",
      );
    }
  };

  const removeAvatar = async () => {
    if (!token) return;
    replaceProfile(await media.removeAvatar(token));
  };
  const status = useSyncStatus();
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
      await updateProfile({ name, nativeLang, learnLangs: learn, bio, profilePublic, showProgress });
      setSaved("Gespeichert.");
    } catch (err) {
      setSaved(err instanceof ApiError && err.status === 0 ? "Offline – nur lokal gespeichert." : "Speichern fehlgeschlagen.");
    }
  };

  const logout = () => {
    const pending = status.pending;
    if (pending > 0 && !window.confirm(`${pending} Änderungen sind noch nicht synchronisiert. Sie bleiben auf diesem Gerät erhalten.`)) return;
    disconnect();
  };

  return (
    <div className="stack">
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
        </div>
      </form>

      <section className="card stack">
        <h2>Profilbild & Sichtbarkeit</h2>
        <div className="row">
          <Avatar name={user.name} url={user.avatarUrl} size={64} />
          {token && avatarOn === true && (
            <div className="row">
              <label className="file-btn">
                Bild hochladen
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
              </label>
              {user.avatarUrl && <button className="small-btn" onClick={removeAvatar}>Entfernen</button>}
            </div>
          )}
        </div>
        {!token && <div className="muted small">Profilbilder gibt es mit Konto.</div>}
        {token && avatarOn === false && <div className="muted small">Profilbilder werden aktiviert, sobald der Server einen Medienspeicher hat.</div>}
        {avatarMsg && <div className="muted small" role="status">{avatarMsg}</div>}
        <label>
          Über mich
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={2} />
        </label>
        <label className="inline">
          <input type="checkbox" checked={profilePublic} onChange={(e) => setProfilePublic(e.target.checked)} />
          Öffentliches Profil (auffindbar, ohne Zustimmung folgbar)
        </label>
        <label className="inline">
          <input type="checkbox" checked={showProgress} onChange={(e) => setShowProgress(e.target.checked)} />
          Lernfortschritt für Freunde sichtbar machen
        </label>
      </section>

      <section className="card stack">
        <h2>Konto & Sync</h2>
        {token ? (
          <>
            <div className="muted">Angemeldet als <b>{user.email}</b>. Deine Daten werden zwischen Geräten synchronisiert.</div>
            {user.id && <a href={`/users/${user.id}`}>Mein öffentliches Profil ansehen</a>}
            <div className="small">Status: {status.error ?? (status.online ? "verbunden" : "offline")} · {status.pending} Änderungen warten</div>
            <div className="row">
              <button className="danger" onClick={logout}>Abmelden</button>
            </div>
          </>
        ) : (
          <>
            <div className="muted">
              Du nutzt VoChat gerade <b>lokal</b> auf diesem Gerät. Alles funktioniert ohne Konto. Mit Konto synchronisierst du
              Wortschatz, Lernfortschritt und Sammlungen zwischen Geräten und kannst Sammlungen teilen und bewerten.
            </div>
            <div className="small muted">Lokal gespeichert: {collections ? "Wortschatz & Fortschritt" : ""}</div>
            <AuthForm
              onAuthenticated={(t, u) => {
                connect(t, u);
              }}
            />
          </>
        )}
      </section>
    </div>
  );
}

