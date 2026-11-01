import type { AuthResponse, LexemeDetail, LexemeSummary, PullResponse, PushResponse, UserProfile } from "@vochat/shared";
import type { LangCode } from "@vochat/shared";

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

  search: (token: string, lang: LangCode, q: string) =>
    request<LexemeSummary[]>(`/dictionary/search?lang=${lang}&q=${encodeURIComponent(q)}&limit=8`, { token }),
  browse: (token: string, lang: LangCode, cefr: string | null, offset: number) =>
    request<LexemeSummary[]>(
      `/dictionary/browse?lang=${lang}${cefr ? `&cefr=${cefr}` : ""}&limit=50&offset=${offset}`,
      { token },
    ),
  lexeme: (token: string, id: number) => request<LexemeDetail>(`/dictionary/lexemes/${id}`, { token }),
};
