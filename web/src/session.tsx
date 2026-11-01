import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { LangCode, UserProfile } from "@vochat/shared";
import { api, ApiError } from "./api/client";
import { clearChats } from "./lib/chatStore";
import { openLocalKv } from "./local/kv";
import { LocalStore } from "./local/localStore";
import { SyncEngine, type SyncStatus } from "./local/syncEngine";
import { createDeviceCollections, type Collections } from "./local/collections";
import { prefs } from "./lib/prefs";
import { newId } from "./lib/ids";

export type ProfilePatch = {
  name?: string;
  bio?: string;
  profilePublic?: boolean;
  showProgress?: boolean;
  nativeLang?: LangCode;
  learnLangs?: UserProfile["learnLangs"];
};

export interface Session {
  /** Profil: lokal (ohne Konto) oder vom Server (mit Konto). */
  user: UserProfile;
  /** Gesetzt, sobald ein Konto verbunden ist. Ohne Konto bleibt die App voll nutzbar. */
  token: string | null;
  collections: Collections;
  engine: SyncEngine;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
  /** Übernimmt ein vom Server geliefertes Profil (z. B. nach Avatar-Upload). */
  replaceProfile: (profile: UserProfile) => void;
  /** Verbindet ein Konto (Sync startet). Anonyme lokale Daten werden hochgeladen, fremde verworfen. */
  connect: (token: string, user: UserProfile) => Promise<void>;
  /** Trennt das Konto. Lokale Daten bleiben erhalten, außer `clearLocal` ist gesetzt. */
  disconnect: (opts?: { clearLocal?: boolean }) => Promise<void>;
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
  const fresh: UserProfile = {
    id: `local-${newId()}`,
    email: "",
    name: "Ich",
    bio: "",
    avatarUrl: null,
    nativeLang: "de",
    learnLangs: [],
    profilePublic: true,
    showProgress: false,
  };
  prefs.set(LOCAL_PROFILE_KEY, JSON.stringify(fresh));
  return fresh;
}

/**
 * Lokaler Speicher und Collections des Geräts: genau einmal pro Seitenladen. Der StrictMode-
 * Doppelaufruf von Effekten darf nicht zwei Collections mit gleicher ID erzeugen.
 */
let deviceRuntime: Promise<{ store: LocalStore; collections: Collections }> | null = null;
function loadDeviceRuntime() {
  deviceRuntime ??= (async () => {
    const store = new LocalStore(openLocalKv());
    await store.load();
    return { store, collections: createDeviceCollections(store) };
  })();
  return deviceRuntime;
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
    let alive = true;
    void loadDeviceRuntime().then((rt) => {
      if (!alive) return;
      setCollections(rt.collections);
      setStore(rt.store);
      setReady(true);
    });
    return () => {
      alive = false;
    };
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
        if (store.owner === "local") store.setOwner(me.id); // Daten aus Versionen ohne Eigentümer zuordnen
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
    async (newToken: string, user: UserProfile) => {
      if (!store) return;
      prefs.set(TOKEN_KEY, newToken);
      prefs.set("vochat.accountProfile", JSON.stringify(user));
      if (store.owner !== "local" && store.owner !== user.id) {
        // Lokale Daten gehören einem anderen Konto: nicht hochladen, sondern verwerfen und neu laden.
        await store.clearAll();
        await clearChats();
        store.setOwner(user.id);
        await store.flush();
        window.location.reload();
        return;
      }
      if (store.owner === "local") {
        store.enqueueAll(); // anonym angelegte Daten zum Konto hochladen
        // Lokal gewählte Lernsprachen ins neue Konto übernehmen, falls dort noch keine stehen.
        if (user.learnLangs.length === 0 && profile.learnLangs.length > 0) {
          user = await api.updateProfile(newToken, { learnLangs: profile.learnLangs }).catch(() => user);
          prefs.set("vochat.accountProfile", JSON.stringify(user));
        }
      }
      store.setOwner(user.id);
      setToken(newToken);
      setProfile(user);
      startEngine(store, newToken, user.id);
    },
    [store, startEngine, profile.learnLangs],
  );

  const disconnect = useCallback(
    async (opts: { clearLocal?: boolean } = {}) => {
      if (!store) return;
      const old = token;
      prefs.set(TOKEN_KEY, null);
      prefs.set("vochat.accountProfile", null);
      if (old) void api.logout(old).catch(() => undefined);
      // Chats gehören zum Konto (Quelle ist der Server): beim Abmelden lokal immer löschen
      await clearChats();
      if (opts.clearLocal) {
        await store.clearAll();
        await store.flush();
        window.location.reload();
        return;
      }
      setToken(null);
      setProfile(readLocalProfile());
      startEngine(store, null, null);
    },
    [store, token, startEngine],
  );

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

  const replaceProfile = useCallback((next: UserProfile) => {
    if (token) prefs.set("vochat.accountProfile", JSON.stringify(next));
    setProfile(next);
  }, [token]);

  const value = useMemo<Session | null>(() => {
    if (!collections || !engine) return null;
    return { user: profile, token, collections, engine, updateProfile, replaceProfile, connect, disconnect };
  }, [collections, engine, profile, token, updateProfile, replaceProfile, connect, disconnect]);

  if (!ready || !value) return <div className="center muted">Lade …</div>;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
