import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LangCode, UserProfile } from "@vochat/shared";
import { api, ApiError } from "./api/client";
import { openLocalKv } from "./local/kv";
import { LocalStore } from "./local/localStore";
import { SyncEngine, type SyncStatus } from "./local/syncEngine";
import { createDeviceCollections, type Collections } from "./local/collections";
import { prefs } from "./lib/prefs";
import { newId } from "./lib/ids";

export type ProfilePatch = { name?: string; nativeLang?: LangCode; learnLangs?: UserProfile["learnLangs"] };

export interface Session {
  /** Profil: lokal (ohne Konto) oder vom Server (mit Konto). */
  user: UserProfile;
  /** Gesetzt, sobald ein Konto verbunden ist. Ohne Konto bleibt die App voll nutzbar. */
  token: string | null;
  collections: Collections;
  engine: SyncEngine;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  /** Verbindet ein Konto (Sync startet). Lokale Daten werden hochgeladen. */
  connect: (token: string, user: UserProfile) => void;
  /** Trennt das Konto. Lokale Daten bleiben erhalten. */
  disconnect: () => void;
}

const SessionContext = createContext<Session | null>(null);
const TOKEN_KEY = "vochat.token";
const LOCAL_PROFILE_KEY = "vochat.localProfile";

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

function readLocalProfile(): UserProfile {
  try {
    const raw = prefs.get(LOCAL_PROFILE_KEY);
    if (raw) return JSON.parse(raw) as UserProfile;
  } catch {
    // beschädigt: neu anlegen
  }
  const fresh: UserProfile = { id: `local-${newId()}`, email: "", name: "Ich", nativeLang: "de", learnLangs: [] };
  prefs.set(LOCAL_PROFILE_KEY, JSON.stringify(fresh));
  return fresh;
}

/**
 * Sitzung ohne Anmeldezwang. Das Gerät hat immer ein lokales Profil und lokale Daten.
 * Ein Konto ist optional und nur für die Synchronisation nötig.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [store, setStore] = useState<LocalStore | null>(null);
  const [collections, setCollections] = useState<Collections | null>(null);
  const [profile, setProfile] = useState<UserProfile>(() => readLocalProfile());
  const [token, setToken] = useState<string | null>(() => prefs.get(TOKEN_KEY));
  const [engine, setEngine] = useState<SyncEngine | null>(null);
  const engineRef = useRef<SyncEngine | null>(null);

  // Einmalig: lokaler Speicher laden, Collections erzeugen.
  useEffect(() => {
    const s = new LocalStore(openLocalKv());
    void s.load().then(() => {
      setCollections(createDeviceCollections(s));
      setStore(s);
      setReady(true);
    });
  }, []);

  const startEngine = useCallback(
    (s: LocalStore, t: string | null, accountId: string | null) => {
      engineRef.current?.stop();
      const e = new SyncEngine(s, t, accountId);
      engineRef.current = e;
      setEngine(e);
      e.start();
      return e;
    },
    [],
  );

  // Mit gespeichertem Token: Profil prüfen und Sync starten (offline mit letztem Stand).
  useEffect(() => {
    if (!store || !ready) return;
    const saved = prefs.get(TOKEN_KEY);
    if (!saved) {
      startEngine(store, null, null);
      return;
    }
    const cached = prefs.get("vochat.accountProfile");
    api
      .me(saved)
      .then((me) => {
        setProfile(me);
        prefs.set("vochat.accountProfile", JSON.stringify(me));
        setToken(saved);
        startEngine(store, saved, me.id);
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 0 && cached) {
          const me = JSON.parse(cached) as UserProfile;
          setProfile(me);
          setToken(saved);
          startEngine(store, saved, me.id);
          return;
        }
        if (error instanceof ApiError && error.status === 401) {
          prefs.set(TOKEN_KEY, null);
          setToken(null);
        }
        startEngine(store, null, null);
      });
  }, [store, ready, startEngine]);

  const connect = useCallback(
    (newToken: string, user: UserProfile) => {
      if (!store) return;
      prefs.set(TOKEN_KEY, newToken);
      prefs.set("vochat.accountProfile", JSON.stringify(user));
      store.enqueueAll(); // lokal angelegte Daten zum Konto hochladen
      setToken(newToken);
      setProfile(user);
      startEngine(store, newToken, user.id);
    },
    [store, startEngine],
  );

  const disconnect = useCallback(() => {
    if (!store) return;
    const old = token;
    prefs.set(TOKEN_KEY, null);
    prefs.set("vochat.accountProfile", null);
    const local = readLocalProfile();
    setToken(null);
    setProfile(local);
    startEngine(store, null, null);
    if (old) void api.logout(old).catch(() => undefined);
  }, [store, token, startEngine]);

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (token) {
        const next = await api.updateProfile(token, patch);
        prefs.set("vochat.accountProfile", JSON.stringify(next));
        setProfile(next);
        return;
      }
      const next = { ...profile, ...patch } as UserProfile;
      prefs.set(LOCAL_PROFILE_KEY, JSON.stringify(next));
      setProfile(next);
    },
    [token, profile],
  );

  const value = useMemo<Session | null>(() => {
    if (!collections || !engine) return null;
    return { user: profile, token, collections, engine, updateProfile, connect, disconnect };
  }, [collections, engine, profile, token, updateProfile, connect, disconnect]);

  if (!ready || !value) return <div className="center muted">Lade …</div>;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
