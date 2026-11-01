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
  publicCollections: (params: { kind?: string; mediaType?: string; q?: string; sort?: string }, token?: string | null) => {
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
    request<{ roles: { role: string; lang: string }[]; contributions: Record<string, number> }>("/community/me", { token }),
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
  kind: "lexeme" | "sense" | "example" | "translation" | "retract";
  lang: string;
  payload: Record<string, unknown>;
  status: "pending" | "verified" | "rejected" | "revoked";
  author: string;
  createdAt: number;
  decidedAt: number | null;
  decisionReason: string | null;
}
