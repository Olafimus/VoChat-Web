import { usePwa } from "../lib/pwa";

/** Hinweis bei neuer Version (Service Worker) – erst auf Klick wird neu geladen. */
export function PwaUpdateBanner() {
  const pwa = usePwa();
  if (!pwa.needRefresh) return null;
  return (
    <div className="pwa-banner" role="status">
      Neue Version verfügbar.
      <button className="small-btn primary" onClick={pwa.update}>Neu laden</button>
    </div>
  );
}

/** „Als App installieren“ – Knopf (Chrome/Edge/Android) oder Anleitung (iOS). */
export function InstallApp({ compact = false }: { compact?: boolean }) {
  const pwa = usePwa();
  if (pwa.installed) return compact ? null : <div className="muted small">✓ Als App installiert.</div>;
  if (pwa.canInstall)
    return (
      <button className={compact ? "button" : "primary"} onClick={() => void pwa.install()}>
        📲 App installieren
      </button>
    );
  if (pwa.iosHint)
    return <div className="muted small">📲 Als App installieren: in Safari auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen.</div>;
  return compact ? null : (
    <div className="muted small">Installieren über das Browser-Menü („App installieren“ bzw. „Zum Startbildschirm hinzufügen“).</div>
  );
}
