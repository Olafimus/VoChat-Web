import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { connectEvents } from "../lib/events";
import { PwaUpdateBanner } from "./PwaBanner";
import { useConversations } from "../lib/useChats";
import { useSession, useSyncStatus } from "../session";
import { useDictionaryLinker } from "../lib/useDictionaryLinker";
import { useScheduleMigration } from "../lib/useScheduleMigration";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { IconCards, IconChats, IconCommunity, IconHome, IconNotes, IconPaths, IconProfile, IconScan, IconShield, IconVocab } from "./icons";

const TABS = [
  { to: "/", label: "Start", short: "Start", Icon: IconHome },
  { to: "/chat", label: "Chats", short: "Chats", Icon: IconChats },
  { to: "/vocab", label: "Wortschatz", short: "Wörter", Icon: IconVocab },
  { to: "/learn", label: "Lernen", short: "Lernen", Icon: IconCards },
  { to: "/paths", label: "Lernpfade", short: "Pfade", Icon: IconPaths },
  { to: "/community", label: "Community", short: "Leute", Icon: IconCommunity },
  { to: "/profile", label: "Profil", short: "Profil", Icon: IconProfile },
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
  useEffect(() => connectEvents(token), [token]);
  const { list } = useConversations(token);
  const unread = list?.reduce((n, c) => n + c.unread, 0) ?? 0;
  const location = useLocation();
  const inConversation = /^\/chat\/(?!assistant)[^/]+$/.test(location.pathname);
  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) VoChat` : "VoChat";
  }, [unread]);
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand" end aria-label="VoChat – Start">
          <Logo />
          <span>VoChat</span>
        </NavLink>
        <nav className="tabs-desktop">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.to === "/"} title={t.label} className={({ isActive }) => (isActive ? "active" : undefined)}>
              <t.Icon size={17} strokeWidth={2} aria-hidden />
              <span className="tab-label">{t.label}</span>
              {t.to === "/chat" && unread > 0 && <span className="nav-badge">{unread > 99 ? "99+" : unread}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-right">
          <NavLink to="/notes" className="scan-link" aria-label="Notizen" title="Notizen">
            <IconNotes size={20} strokeWidth={2} />
          </NavLink>
          {token && user.roles?.some((r) => r.role === "admin") && (
            <NavLink to="/admin" className="scan-link" aria-label="Verwaltung" title="Verwaltung">
              <IconShield size={20} strokeWidth={2} />
            </NavLink>
          )}
          <NavLink to="/scan" className="scan-link" aria-label="Foto scannen" title="Foto → Vokabeln">
            <IconScan size={20} strokeWidth={2} />
          </NavLink>
          <SyncIndicator />
          <NavLink to="/profile" className="me-link hide-sm" title={token ? user.name : "Gast"}>
            <Avatar name={token ? user.name : "Gast"} url={token ? (user.avatarUrl ?? null) : null} size={30} />
          </NavLink>
        </div>
      </header>
      <PwaUpdateBanner />
      <main className={`content ${inConversation ? "content-chat" : ""}`}>
        <Outlet />
      </main>
      <nav className="tabs-mobile" aria-label="Hauptnavigation">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === "/"} className={({ isActive }) => (isActive ? "active" : undefined)}>
            <span aria-hidden className="nav-icon">
              <t.Icon size={21} strokeWidth={2} />
              {t.to === "/chat" && unread > 0 && <span className="nav-badge">{unread > 99 ? "99+" : unread}</span>}
            </span>
            <span>{t.short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
