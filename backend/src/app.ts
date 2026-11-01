import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  CEFR_LEVELS,
  type Cefr,
  isLangCode,
  loginSchema,
  profileUpdateSchema,
  pushRequestSchema,
  ratingSchema,
  registerSchema,
  type LangCode,
} from "@vochat/shared";
import { createSession, deleteSession, hashPassword, requireAuth, optionalAuth, maybeUserId, verifyPassword, currentUserId } from "./auth.js";
import { builtinPathDetail, builtinPaths, getPublicCollection, listPublicCollections, myRating, upsertRating } from "./catalog.js";
import { type Db, transaction } from "./db.js";
import { browseLexemes, languageStats, lexemeDetail, searchLexemes } from "./dictionary.js";
import { createUser, findUserByEmail, loadProfile, authResponse } from "./users.js";
import { pullChanges, pushOps } from "./sync.js";

export interface AppOptions {
  db: Db;
  now?: () => number;
  corsOrigins?: string[];
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

export function createApp({ db, now = Date.now, corsOrigins = ["http://localhost:5173"] }: AppOptions): Hono {
  const app = new Hono();
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();

  app.use("*", cors({ origin: corsOrigins, allowHeaders: ["Authorization", "Content-Type"], allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"] }));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: "internal" }, 500);
  });

  app.get("/health", (c) => c.json({ ok: true }));

  // ---- Auth -------------------------------------------------------------
  app.post("/auth/register", async (c) => {
    const parsed = registerSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const email = parsed.data.email.trim().toLowerCase();
    if (findUserByEmail(db, email)) return c.json({ error: "email already registered" }, 409);

    const passwordHash = await hashPassword(parsed.data.password);
    const userId = transaction(db, () =>
      createUser(db, { email, name: parsed.data.name.trim(), nativeLang: parsed.data.nativeLang as LangCode, passwordHash }, now()),
    );
    const token = createSession(db, userId, now());
    return c.json(authResponse(token, loadProfile(db, userId)!), 201);
  });

  app.post("/auth/login", async (c) => {
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const email = parsed.data.email.trim().toLowerCase();

    const bucket = loginAttempts.get(email);
    if (bucket && bucket.resetAt > now() && bucket.count >= LOGIN_MAX_ATTEMPTS) {
      return c.json({ error: "too many attempts, try later" }, 429);
    }

    const user = findUserByEmail(db, email);
    const ok = user ? await verifyPassword(parsed.data.password, user.password_hash) : false;
    if (!user || !ok) {
      const current = loginAttempts.get(email);
      if (!current || current.resetAt <= now()) loginAttempts.set(email, { count: 1, resetAt: now() + LOGIN_WINDOW_MS });
      else current.count++;
      return c.json({ error: "invalid credentials" }, 401);
    }
    loginAttempts.delete(email);
    const token = createSession(db, user.id, now());
    return c.json(authResponse(token, loadProfile(db, user.id)!));
  });

  const auth = requireAuth(db, now);
  const maybeAuth = optionalAuth(db, now);

  app.post("/auth/logout", auth, (c) => {
    const token = (c.req.header("authorization") ?? "").slice(7).trim();
    deleteSession(db, token);
    return c.json({ ok: true });
  });

  // ---- Profil -----------------------------------------------------------
  app.get("/me", auth, (c) => {
    const profile = loadProfile(db, currentUserId(c));
    return profile ? c.json(profile) : c.json({ error: "not found" }, 404);
  });

  app.patch("/me", auth, async (c) => {
    const parsed = profileUpdateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const userId = currentUserId(c);
    transaction(db, () => {
      if (parsed.data.name) db.prepare("UPDATE users SET name = ? WHERE id = ?").run(parsed.data.name.trim(), userId);
      if (parsed.data.nativeLang) db.prepare("UPDATE users SET native_lang = ? WHERE id = ?").run(parsed.data.nativeLang, userId);
      if (parsed.data.learnLangs) {
        db.prepare("DELETE FROM user_learn_langs WHERE user_id = ?").run(userId);
        const insert = db.prepare("INSERT INTO user_learn_langs (user_id, lang, target_cefr) VALUES (?, ?, ?)");
        for (const l of parsed.data.learnLangs) insert.run(userId, l.lang, l.targetCefr);
      }
    });
    return c.json(loadProfile(db, userId));
  });

  // ---- Sync -------------------------------------------------------------
  app.post("/sync/push", auth, async (c) => {
    const parsed = pushRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    return c.json(pushOps(db, currentUserId(c), parsed.data.ops));
  });

  app.get("/sync/changes", auth, (c) => {
    const since = Math.max(0, Number(c.req.query("since") ?? 0) || 0);
    const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? 200) || 200));
    return c.json(pullChanges(db, currentUserId(c), since, limit));
  });

  // ---- Wörterbuch (read-only, global) ----------------------------------
  app.get("/dictionary/languages", (c) => c.json(languageStats(db)));

  app.get("/dictionary/search", (c) => {
    const lang = c.req.query("lang") ?? "";
    const q = c.req.query("q") ?? "";
    if (!isLangCode(lang) || q.length > 100) return c.json({ error: "invalid input" }, 400);
    const nativeLang = nativeParam(c.req.query("native"));
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20) || 20));
    return c.json(searchLexemes(db, { lang, q, nativeLang, limit }));
  });

  app.get("/dictionary/browse", (c) => {
    const lang = c.req.query("lang") ?? "";
    const cefr = c.req.query("cefr");
    if (!isLangCode(lang) || (cefr && !(CEFR_LEVELS as readonly string[]).includes(cefr))) {
      return c.json({ error: "invalid input" }, 400);
    }
    const nativeLang = nativeParam(c.req.query("native"));
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 50) || 50));
    const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
    return c.json(browseLexemes(db, { lang, nativeLang, cefr: cefr as Cefr | undefined, limit, offset }));
  });

  app.get("/dictionary/lexemes/:id", (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
    const nativeLang = nativeParam(c.req.query("native"));
    const detail = lexemeDetail(db, id, nativeLang);
    return detail ? c.json(detail) : c.json({ error: "not found" }, 404);
  });

  // ---- Katalog: Lernpfade & Medien-Sammlungen (öffentlich lesbar) ------
  app.get("/catalog/paths", (c) => {
    const lang = c.req.query("lang") ?? "";
    if (!isLangCode(lang)) return c.json({ error: "invalid input" }, 400);
    return c.json(builtinPaths(db, lang));
  });

  app.get("/catalog/paths/:id", (c) => {
    const detail = builtinPathDetail(db, c.req.param("id"), nativeParam(c.req.query("native")));
    return detail ? c.json(detail) : c.json({ error: "not found" }, 404);
  });

  app.get("/catalog/collections", (c) => {
    const kind = c.req.query("kind");
    const lang = c.req.query("lang");
    const sort = c.req.query("sort") === "rating" ? "rating" : "new";
    const items = listPublicCollections(
      db,
      {
        kind: kind === "path" || kind === "media" ? kind : undefined,
        mediaType: c.req.query("mediaType") || undefined,
        lang: lang && isLangCode(lang) ? lang : undefined,
        q: (c.req.query("q") ?? "").slice(0, 80) || undefined,
      },
      sort,
      50,
    );
    return c.json(items);
  });

  app.get("/catalog/collections/:id", maybeAuth, (c) => {
    const found = getPublicCollection(db, c.req.param("id"));
    if (!found) return c.json({ error: "not found" }, 404);
    const userId = maybeUserId(c);
    return c.json({ ...found, myRating: userId ? myRating(db, found.id, userId) : null });
  });

  app.put("/catalog/collections/:id/rating", auth, async (c) => {
    const parsed = ratingSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const ok = upsertRating(db, c.req.param("id"), currentUserId(c), parsed.data.difficulty, now());
    return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });

  return app;
}

function nativeParam(value: string | undefined): LangCode {
  return value && isLangCode(value) ? value : "de";
}
