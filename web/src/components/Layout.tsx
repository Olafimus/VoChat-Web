import { NavLink, Outlet } from "react-router-dom";
import { useSession, useSyncStatus } from "../session";
import { useDictionaryLinker } from "../lib/useDictionaryLinker";
import { useScheduleMigration } from "../lib/useScheduleMigration";

const TABS = [
  { to: "/", label: "Start", short: "Start", icon: "🏠" },
  { to: "/chat", label: "Chat", short: "Chat", icon: "💬" },
  { to: "/vocab", label: "Wortschatz", short: "Wörter", icon: "📚" },
  { to: "/learn", label: "Lernen", short: "Lernen", icon: "🧠" },
  { to: "/paths", label: "Lernpfade", short: "Pfade", icon: "🗺️" },
  { to: "/community", label: "Community", short: "Leute", icon: "🤝" },
  { to: "/profile", label: "Profil", short: "Profil", icon: "👤" },
];

export function SyncIndicator() {
  const status = useSyncStatus();
  const label = !status.enabled
    ? status.pending > 0
      ? `lokal · ${status.pending} ungesendet`
      : "lokal"
    : !status.online
      ? "offline"
      : status.syncing
      ? "synchronisiert…"
      : status.pending > 0
        ? `${status.pending} ausstehend`
        : "synchron";
  const tone = !status.enabled ? "local" : !status.online ? "warn" : status.error ? "error" : status.pending > 0 ? "pending" : "ok";
  return (
    <span className={`sync sync-${tone}`} title={status.error ?? undefined}>
      <span className="dot" /> <span className="sync-label">{label}</span>
    </span>
  );
}

export function Layout() {
  const { user, token } = useSession();
  useDictionaryLinker();
  useScheduleMigration();
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand" end>VoChat</NavLink>
        <nav className="tabs-desktop">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === "/"} className={({ isActive }) => (isActive ? "active" : undefined)}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <NavLink to="/scan" className="scan-link" aria-label="Foto scannen" title="Foto → Vokabeln">📷</NavLink>
          <SyncIndicator />
          <span className="muted hide-sm">{token ? user.name : "Gast"}</span>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabs-mobile" aria-label="Hauptnavigation">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === "/"} className={({ isActive }) => (isActive ? "active" : undefined)}>
            <span aria-hidden>{t.icon}</span>
            <span>{t.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
