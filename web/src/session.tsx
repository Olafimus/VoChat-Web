import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { UserProfile } from "@vochat/shared";
import { api, ApiError } from "./api/client";
import { clearUserKv, openUserKv } from "./local/kv";
import { LocalStore } from "./local/localStore";
import { SyncEngine, type SyncStatus } from "./local/syncEngine";
import { createUserCollections, type Collections } from "./local/collections";
import { prefs } from "./lib/prefs";
import { AuthPage } from "./pages/AuthPage";

export interface Session {
  token: string;
  user: UserProfile;
  collections: Collections;
  engine: SyncEngine;
  setUser: (u: UserProfile) => void;
  logout: () => void;
}

const SessionContext = createContext<Session | null>(null);
const TOKEN_KEY = "vochat.token";
const PROFILE_KEY = "vochat.profile";

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession außerhalb der Session");
  return s;
}

export function useSyncStatus(): SyncStatus {
  const { engine } = useSession();
  const [, force] = useState(0);
  useEffect(() => engine.subscribe(() => force((n) => n + 1)), [engine]);
  return engine.getStatus();
}

const readCachedProfile = (): UserProfile | null => {
  try {
    const raw = prefs.get(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch {
    return null;
  }
};

interface UserRuntime {
  store: LocalStore;
  collections: Collections;
  engine: SyncEngine;
}

/**
 * Laufzeit pro Nutzer (Speicher, Collections, Sync-Engine). Einmal erzeugt und
 * wiederverwendet – auch bei doppelten Effekt-Aufrufen (StrictMode) –, damit
 * TanStack DB nie zwei Quellen mit gleicher Collection-ID sieht.
 */
const runtimes = new Map<string, Promise<UserRuntime>>();

function getRuntime(profile: UserProfile, token: string): Promise<UserRuntime> {
  let pending = runtimes.get(profile.id);
  if (!pending) {
    pending = (async () => {
      const store = new LocalStore(openUserKv(profile.id));
      await store.load();
      const engine = new SyncEngine(store, token);
      engine.start();
      return { store, collections: createUserCollections(store, profile.id), engine };
    })();
    runtimes.set(profile.id, pending);
  }
  return pending;
}

async function dropRuntime(userId: string, clearLocal: boolean) {
  const pending = runtimes.get(userId);
  runtimes.delete(userId);
  if (!pending) return;
  const runtime = await pending;
  runtime.engine.stop();
  if (clearLocal) await clearUserKv(openUserKv(userId)!);
}

/**
 * Hält die Sitzung: Token und Profil bleiben lokal erhalten, so dass die App auch
 * offline startet. Lokaler Speicher, Sync-Engine und Collections hängen am Nutzer.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [phase, setPhase] = useState<"loading" | "anon" | "ready">("loading");

  const activate = useCallback(async (token: string, profile: UserProfile) => {
    prefs.set(PROFILE_KEY, JSON.stringify(profile));
    const runtime = await getRuntime(profile, token);
    setSession({
      token,
      user: profile,
      collections: runtime.collections,
      engine: runtime.engine,
      setUser: (user) => {
        prefs.set(PROFILE_KEY, JSON.stringify(user));
        setSession((prev) => (prev ? { ...prev, user } : prev));
      },
      logout: () => {
        const userId = profile.id;
        const pendingChanges = runtime.engine.getStatus().pending;
        if (pendingChanges > 0 && !window.confirm(`${pendingChanges} Änderungen sind noch nicht synchronisiert. Trotzdem abmelden? Sie werden dann gelöscht.`)) {
          return;
        }
        prefs.set(TOKEN_KEY, null);
        prefs.set(PROFILE_KEY, null);
        setSession(null);
        setPhase("anon");
        void dropRuntime(userId, true);
        void api.logout(token).catch(() => undefined);
      },
    });
    setPhase("ready");
  }, []);

  useEffect(() => {
    const token = prefs.get(TOKEN_KEY);
    if (!token) {
      setPhase("anon");
      return;
    }
    const cached = readCachedProfile();
    api
      .me(token)
      .then((profile) => activate(token, profile))
      .catch((error) => {
        if (error instanceof ApiError && error.status === 0 && cached) {
          // offline: mit zwischengespeichertem Profil weiterarbeiten
          void activate(token, cached);
          return;
        }
        if (error instanceof ApiError && error.status === 401) prefs.set(TOKEN_KEY, null);
        setPhase("anon");
      });
  }, [activate]);

  if (phase === "loading") return <div className="center muted">Lade …</div>;
  if (phase === "anon" || !session) {
    return (
      <AuthPage
        onAuthenticated={(token, profile) => {
          prefs.set(TOKEN_KEY, token);
          void activate(token, profile);
        }}
      />
    );
  }
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
