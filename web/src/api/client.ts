import type { ChallengeDetail, ChallengeItem, ChallengeSummary } from "@vochat/shared";
import type {
  AuthResponse,
  CatalogCollection,
  LangCode,
  LexemeDetail,
  LexemeSummary,
  PullResponse,
  PushResponse,
  UserProfile,
} from "@vochat/shared";

const BASE: string = import.meta.env.VITE_API_URL ?? "/api";

/** Vom Server gelieferte Pfade (z. B. Avatar-Links) liegen hinter der API-Basis. */
export const apiUrl = (path: string): string => (path.startsWith("/") ? BASE + path : path);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Netzwerkfehler (offline) werden als ApiError mit Status 0 gemeldet. */
async function request<T>(path: string, init: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      method: init.method ?? "GET",
      headers: {
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "offline");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, data.error ?? res.statusText);
  }
  return (await res.json()) as T;
}

/** Öffentliche Endpunkte (Wörterbuch, Katalog) brauchen kein Konto. */
export const api = {
  register: (input: { email: string; password: string; name: string; nativeLang: LangCode }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: input }),
  login: (input: { email: string; password: string }) => request<AuthResponse>("/auth/login", { method: "POST", body: input }),
  logout: (token: string) => request<{ ok: boolean }>("/auth/logout", { method: "POST", token }),
  me: (token: string) => request<UserProfile>("/me", { token }),
  updateProfile: (token: string, body: unknown) => request<UserProfile>("/me", { method: "PATCH", body, token }),

  push: (token: string, ops: { entity: string; row: unknown }[]) =>
    request<PushResponse>("/sync/push", { method: "POST", body: { ops }, token }),
  pull: (token: string, since: number, limit = 500) =>
    request<PullResponse>(`/sync/changes?since=${since}&limit=${limit}`, { token }),

  search: (lang: LangCode, q: string, native: LangCode) =>
    request<LexemeSummary[]>(`/dictionary/search?lang=${lang}&q=${encodeURIComponent(q)}&limit=8&native=${native}`),
  browse: (lang: LangCode, cefr: string | null, offset: number, native: LangCode) =>
    request<LexemeSummary[]>(
      `/dictionary/browse?lang=${lang}${cefr ? `&cefr=${cefr}` : ""}&limit=50&offset=${offset}&native=${native}`,
    ),
  lexeme: (id: number, native: LangCode) => request<LexemeDetail>(`/dictionary/lexemes/${id}?native=${native}`),

  paths: (lang: LangCode) => request<CatalogCollection[]>(`/catalog/paths?lang=${lang}`),
  pathDetail: (id: string, native: LangCode) =>
    request<CatalogCollection>(`/catalog/paths/${encodeURIComponent(id)}?native=${native}`),
  publicCollections: (params: { kind?: string; mediaType?: string; q?: string; sort?: string; owner?: string; lang?: string }, token?: string | null) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return request<CatalogCollection[]>(`/catalog/collections${qs ? `?${qs}` : ""}`, { token });
  },
  publicCollection: (id: string, token?: string | null) =>
    request<CatalogCollection & { myRating: number | null }>(`/catalog/collections/${encodeURIComponent(id)}`, { token }),
  rate: (token: string, id: string, difficulty: number) =>
    request<{ ok: boolean }>(`/catalog/collections/${encodeURIComponent(id)}/rating`, { method: "PUT", body: { difficulty }, token }),
};

export const community = {
  me: (token: string) =>
    request<{
      roles: { role: string; lang: string }[];
      contributions: Record<string, number>;
      reputation: { score: number; verifiedContributions: number; agreeingVotes: number; commentScore: number; expertActions: number };
    }>("/community/me", { token }),
  list: (token: string, params: { status?: string; lang?: string; mine?: boolean }) => {
    const qs = new URLSearchParams(
      Object.entries({ status: params.status, lang: params.lang, mine: params.mine ? "1" : undefined }).filter(([, v]) => v) as [string, string][],
    ).toString();
    return request<CommunityRow[]>(`/community/contributions${qs ? `?${qs}` : ""}`, { token });
  },
  submit: (token: string, payload: unknown) =>
    request<{ id: number; status: string }>("/community/contributions", { method: "POST", body: { payload }, token }),
  vote: (token: string, id: number, vote: "verify" | "reject") =>
    request<{ status: string }>(`/community/contributions/${id}/vote`, { method: "POST", body: { vote }, token }),
  decide: (token: string, id: number, decision: "verify" | "reject" | "revoke") =>
    request<{ status: string }>(`/community/contributions/${id}/decide`, { method: "POST", body: { decision }, token }),
  grant: (token: string, email: string, role: "admin" | "expert", lang: string | null) =>
    request<{ ok: boolean }>("/admin/roles", { method: "POST", body: { email, role, lang }, token }),
};

export interface CommunityRow {
  id: number;
  kind: "lexeme" | "sense" | "example" | "translation" | "retract" | "pronunciation";
  lang: string;
  payload: Record<string, unknown>;
  status: "pending" | "verified" | "rejected" | "revoked";
  author: string;
  createdAt: number;
  decidedAt: number | null;
  decisionReason: string | null;
}

export interface FeedItem {
  type: "collection" | "contribution";
  userId: string;
  userName: string;
  at: number;
  title: string;
  detail: string;
}

export interface PersonRef {
  id: string;
  name: string;
  avatarUrl: string | null;
  isPrivate: boolean;
}

export const media = {
  features: () => request<{ avatars: boolean; mediaDriver: string | null }>("/features"),
  async uploadAvatar(token: string, file: Blob): Promise<UserProfile> {
    let res: Response;
    try {
      res = await fetch(`${BASE}/me/avatar`, {
        method: "PUT",
        headers: { authorization: `Bearer ${token}`, "content-type": file.type },
        body: file,
      });
    } catch {
      throw new ApiError(0, "offline");
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(res.status, data.error ?? res.statusText);
    }
    return (await res.json()) as UserProfile;
  },
  removeAvatar: (token: string) => request<UserProfile>("/me/avatar", { method: "DELETE", token }),
};

export const social = {
  feed: (token: string) => request<FeedItem[]>("/social/feed", { token }),
  friends: (token: string) => request<PersonRef[]>("/social/friends", { token }),
  requests: (token: string) => request<{ friends: PersonRef[]; follows: PersonRef[] }>("/social/requests", { token }),
  search: (token: string, q: string) => request<PersonRef[]>(`/social/users?q=${encodeURIComponent(q)}`, { token }),
  follow: (token: string, id: string) => request<{ state: string }>(`/social/follow/${id}`, { method: "POST", token }),
  unfollow: (token: string, id: string) => request<{ state: string }>(`/social/follow/${id}`, { method: "DELETE", token }),
  followRespond: (token: string, id: string, action: "accept" | "decline") =>
    request<{ ok: boolean }>(`/social/follow-requests/${id}/${action}`, { method: "POST", token }),
  befriend: (token: string, id: string) => request<{ state: string }>(`/social/friends/${id}`, { method: "POST", token }),
  friendRespond: (token: string, id: string, action: "accept" | "decline") =>
    request<{ ok: boolean }>(`/social/friends/${id}/${action}`, { method: "POST", token }),
  unfriend: (token: string, id: string) => request<{ state: string }>(`/social/friends/${id}`, { method: "DELETE", token }),
};

export const people = {
  get: (id: string, token?: string | null) => request<PublicUserView>(`/users/${id}`, { token }),
};

export interface PublicUserView {
  id: string;
  name: string;
  avatarUrl: string | null;
  isPrivate: boolean;
  bio: string | null;
  stats: { followers: number; following: number; publicCollections: number; verifiedContributions: number } | null;
  score?: number | null;
  progress: { known: number; learning: number } | null;
  relation: { following: "none" | "requested" | "accepted"; followedBy: boolean; friend: "none" | "outgoing" | "incoming" | "accepted" };
}

/** Wortextraktion ist lesend und funktioniert ohne Konto. */
export const extract = (lang: LangCode, text: string, native: LangCode) =>
  request<import("@vochat/shared").ExtractResult>(`/dictionary/extract?native=${native}`, {
    method: "POST",
    body: { lang, text },
  });

/** Wörter zu Wörterbuch-Einträgen auflösen (Schlüssel -> Eintrag). Lesend, ohne Konto. */
export const resolveWords = (lang: LangCode, words: string[], native: LangCode) =>
  request<Record<string, LexemeSummary>>(`/dictionary/resolve?native=${native}`, { method: "POST", body: { lang, words } });

/** Mehrere Einträge auf einmal (zum Aktualisieren verknüpfter Karten). */
export const lexemesBatch = (ids: number[], native: LangCode) =>
  request<LexemeSummary[]>(`/dictionary/lexemes/batch?native=${native}`, { method: "POST", body: { ids } });

/* ---------- Gemeinsam lernen, Expertenprüfung, Kommentare ---------- */


export const challenges = {
  list: (token: string) => request<ChallengeSummary[]>("/challenges", { token }),
  weekly: (token: string, lang: string) => request<ChallengeDetail | null>(`/challenges/weekly?lang=${lang}`, { token }),
  get: (token: string, id: string) => request<ChallengeDetail>(`/challenges/${encodeURIComponent(id)}`, { token }),
  create: (token: string, body: { kind: "duel" | "group"; title: string; lang: string; items: ChallengeItem[]; days: number; invite: string[] }) =>
    request<{ id: string }>("/challenges", { method: "POST", body, token }),
  act: (token: string, id: string, action: "accept" | "decline" | "join" | "leave") =>
    request<{ ok: boolean }>(`/challenges/${encodeURIComponent(id)}/${action}`, { method: "POST", token }),
};

export interface ReviewEntry {
  id: number;
  lang: LangCode;
  lemma: string;
  pos: string | null;
  romanization: string | null;
  frequencyRank: number | null;
  status: "unreviewed" | "approved" | "needs_fix";
  reviewedBy: string | null;
  reviewedAt: number | null;
  suspicions: { reason: string; score: number }[];
  senses: { id: number; glossLang: string; gloss: string; source: string }[];
  translations: { id: number; targetLang: string; targetLemma: string; source: string }[];
  examples: { id: number; text: string; translation: string | null; source: string }[];
}

export interface HistoryEntry {
  id: number;
  action: string;
  actor: { id: string; name: string } | null;
  details: Record<string, unknown> | null;
  at: number;
}

export const review = {
  queue: (token: string, lang: string, filter: string, offset = 0, limit = 15) =>
    request<{ stats: { approved: number; needsFix: number; suspicious: number }; entries: ReviewEntry[] }>(
      `/review/queue?lang=${lang}&filter=${filter}&offset=${offset}&limit=${limit}`,
      { token },
    ),
  act: (token: string, lexemeId: number, body: Record<string, unknown>) =>
    request<{ ok: boolean; suspicious: number }>(`/review/lexemes/${lexemeId}`, { method: "POST", body, token }),
  history: (lexemeId: number) => request<HistoryEntry[]>(`/history/lexemes/${lexemeId}`),
};

export interface CommentView {
  id: number;
  parentId: number | null;
  author: { id: string; name: string; avatarUrl: string | null } | null;
  body: string | null;
  createdAt: number;
  editedAt: number | null;
  score: number;
  myVote: number;
}

export const comments = {
  list: (token: string, target: string) => request<CommentView[]>(`/comments?target=${encodeURIComponent(target)}`, { token }),
  add: (token: string, target: string, body: string, parentId: number | null) =>
    request<{ id: number }>("/comments", { method: "POST", body: { target, body, parentId }, token }),
  vote: (token: string, id: number, value: -1 | 0 | 1) => request<{ ok: boolean }>(`/comments/${id}/vote`, { method: "POST", body: { value }, token }),
  remove: (token: string, id: number) => request<{ ok: boolean }>(`/comments/${id}`, { method: "DELETE", token }),
};
