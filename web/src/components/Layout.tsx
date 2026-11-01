import { NavLink, Outlet } from "react-router-dom";
import { useSession, useSyncStatus } from "../session";

const TABS = [
  { to: "/chat", label: "Chat", icon: "💬" },
  { to: "/vocab", label: "Wortschatz", icon: "📚" },
  { to: "/learn", label: "Lernen", icon: "🧠" },
  { to: "/paths", label: "Lernpfade", icon: "🗺️" },
  { to: "/community", label: "Community", icon: "🤝" },
  { to: "/profile", label: "Profil", icon: "👤" },
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
      <span className="dot" /> {label}
    </span>
  );
}

export function Layout() {
  const { user, token } = useSession();
  return (
    <div className="app">
      <header className="topbar">
        <strong className="brand">VoChat</strong>
        <nav className="tabs-desktop">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <SyncIndicator />
          <span className="muted hide-sm">{token ? user.name : "Gast"}</span>
        </div>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <nav className="tabs-mobile" aria-label="Hauptnavigation">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? "active" : undefined)}>
            <span aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
