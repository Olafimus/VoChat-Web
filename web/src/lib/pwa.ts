import { useEffect, useState } from "react";

/**
 * Installation als App und Updates des Service Workers.
 * - Chrome/Edge/Android: „beforeinstallprompt“ → eigener Installieren-Knopf.
 * - iOS/Safari: kein Prompt – Hinweis „Teilen → Zum Home-Bildschirm“.
 * - Neue Version: Hinweis mit „Neu laden“, statt mitten in der Nutzung umzuschalten.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let updateSW: ((reload?: boolean) => Promise<void>) | null = null;
let needRefresh = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((fn) => fn());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

export async function registerServiceWorker(): Promise<void> {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const { registerSW } = await import("virtual:pwa-register");
  updateSW = registerSW({
    onNeedRefresh() {
      needRefresh = true;
      notify();
    },
  });
}

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function usePwa() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return {
    canInstall: !!deferred,
    installed: isStandalone(),
    iosHint: !isStandalone() && isIos(),
    needRefresh,
    install: async () => {
      if (!deferred) return;
      await deferred.prompt();
      await deferred.userChoice;
      deferred = null;
      notify();
    },
    update: () => void updateSW?.(true),
  };
}
