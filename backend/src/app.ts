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
import {
  DEFAULT_COMMUNITY,
  canDecide,
  decide,
  grantRole,
  isAdmin,
  listContributions,
  loadContribution,
  revokeRole,
  rolesOf,
  submitContribution,
  tally,
  vote,
  type CommunityOptions,
} from "./community.js";
import { decideSchema, grantSchema, submitSchema, voteSchema, type ContributionStatus } from "@vochat/shared";
import { feed, follow, followState, friendState, listFollowers, listFollowing, listFriends, listRequests, removeFriend, requestFriend, respondFollowRequest, respondFriendRequest, searchUsers, publicUser, unfollow } from "./social.js";
import { MAX_AVATAR_BYTES, sniffImage, type MediaStore } from "./media.js";

export interface AppOptions {
  db: Db;
  now?: () => number;
  corsOrigins?: string[];
  /** E-Mail-Adressen, die beim Anmelden automatisch Admin-Rechte bekommen. */
  adminEmails?: string[];
  community?: CommunityOptions;
  /** Medien-Speicher (Profilbilder). `null`: Uploads sind deaktiviert. */
  media?: MediaStore | null;
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

export function createApp({
  db,
  now = Date.now,
  corsOrigins = ["http://localhost:5173"],
  adminEmails = [],
  community = DEFAULT_COMMUNITY,
  media = null,
}: AppOptions): Hono {
  const app = new Hono();
  const admins = new Set(adminEmails.map((e) => e.toLowerCase()));
  const bootstrapAdmin = (userId: string, email: string) => {
    if (admins.has(email.toLowerCase())) grantRole(db, userId, "admin", "", now());
  };
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
    bootstrapAdmin(userId, email);
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
    bootstrapAdmin(user.id, email);
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
      if (parsed.data.bio !== undefined) db.prepare("UPDATE users SET bio = ? WHERE id = ?").run(parsed.data.bio.trim(), userId);
      if (parsed.data.profilePublic !== undefined) db.prepare("UPDATE users SET profile_public = ? WHERE id = ?").run(parsed.data.profilePublic ? 1 : 0, userId);
      if (parsed.data.showProgress !== undefined) db.prepare("UPDATE users SET show_progress = ? WHERE id = ?").run(parsed.data.showProgress ? 1 : 0, userId);
      if (parsed.data.nativeLang) db.prepare("UPDATE users SET native_lang = ? WHERE id = ?").run(parsed.data.nativeLang, userId);
      if (parsed.data.learnLangs) {
        db.prepare("DELETE FROM user_learn_langs WHERE user_id = ?").run(userId);
        const insert = db.prepare("INSERT INTO user_learn_langs (user_id, lang, target_cefr) VALUES (?, ?, ?)");
        for (const l of parsed.data.learnLangs) insert.run(userId, l.lang, l.targetCefr);
      }
    });
    return c.json(loadProfile(db, userId));
  });

  // ---- Features & Medien ---------------------------------------------------
  app.get("/features", (c) => c.json({ avatars: media !== null, mediaDriver: media?.driver ?? null }));

  app.put("/me/avatar", auth, async (c) => {
    if (!media) return c.json({ error: "media storage not configured" }, 503);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return c.json({ error: "image too large or empty" }, 413);
    const image = sniffImage(bytes);
    if (!image) return c.json({ error: "unsupported image type (png, jpeg, webp)" }, 415);
    const userId = currentUserId(c);
    const previous = db.prepare("SELECT avatar_ext FROM users WHERE id = ?").get(userId) as { avatar_ext: string | null } | undefined;
    await media.put(`avatars/${userId}.${image.ext}`, bytes, image.contentType);
    if (previous?.avatar_ext && previous.avatar_ext !== image.ext) await media.delete(`avatars/${userId}.${previous.avatar_ext}`);
    db.prepare("UPDATE users SET avatar_ext = ?, avatar_version = avatar_version + 1 WHERE id = ?").run(image.ext, userId);
    return c.json(loadProfile(db, userId));
  });

  app.delete("/me/avatar", auth, async (c) => {
    const userId = currentUserId(c);
    const row = db.prepare("SELECT avatar_ext FROM users WHERE id = ?").get(userId) as { avatar_ext: string | null } | undefined;
    if (media && row?.avatar_ext) await media.delete(`avatars/${userId}.${row.avatar_ext}`);
    db.prepare("UPDATE users SET avatar_ext = NULL, avatar_version = avatar_version + 1 WHERE id = ?").run(userId);
    return c.json(loadProfile(db, userId));
  });

  app.get("/media/avatars/:userId", maybeAuth, async (c) => {
    if (!media) return c.json({ error: "not found" }, 404);
    const id = c.req.param("userId");
    const row = db.prepare("SELECT avatar_ext, profile_public FROM users WHERE id = ?").get(id) as
      | { avatar_ext: string | null; profile_public: number }
      | undefined;
    if (!row?.avatar_ext) return c.json({ error: "not found" }, 404);
    const viewer = maybeUserId(c);
    const visible = row.profile_public === 1 || viewer === id || (viewer !== undefined && followState(db, viewer, id) === "accepted");
    if (!visible) return c.json({ error: "not found" }, 404);
    const object = await media.get(`avatars/${id}.${row.avatar_ext}`);
    if (!object) return c.json({ error: "not found" }, 404);
    return new Response(object.body as unknown as BodyInit, {
      headers: { "content-type": object.contentType, "cache-control": "public, max-age=3600" },
    });
  });

  // ---- Öffentliche Profile & Social ---------------------------------------
  app.get("/users/:id", maybeAuth, (c) => {
    const found = publicUser(db, maybeUserId(c) ?? null, c.req.param("id"));
    return found ? c.json(found) : c.json({ error: "not found" }, 404);
  });

  app.get("/social/users", auth, (c) => c.json(searchUsers(db, currentUserId(c), c.req.query("q") ?? "")));

  app.post("/social/follow/:id", auth, (c) => {
    const result = follow(db, currentUserId(c), c.req.param("id"), now());
    return result.ok ? c.json({ state: result.state }) : c.json({ error: result.error }, result.status as 400);
  });
  app.delete("/social/follow/:id", auth, (c) => {
    unfollow(db, currentUserId(c), c.req.param("id"));
    return c.json({ state: "none" });
  });

  app.post("/social/follow-requests/:id/:action", auth, (c) => {
    const action = c.req.param("action");
    if (action !== "accept" && action !== "decline") return c.json({ error: "invalid action" }, 400);
    const ok = respondFollowRequest(db, currentUserId(c), c.req.param("id"), action === "accept");
    return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });

  app.post("/social/friends/:id", auth, (c) => {
    const result = requestFriend(db, currentUserId(c), c.req.param("id"), now());
    return result.ok ? c.json({ state: result.state }) : c.json({ error: result.error }, result.status as 400);
  });
  app.post("/social/friends/:id/:action", auth, (c) => {
    const action = c.req.param("action");
    if (action !== "accept" && action !== "decline") return c.json({ error: "invalid action" }, 400);
    const ok = respondFriendRequest(db, currentUserId(c), c.req.param("id"), action === "accept");
    return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });
  app.delete("/social/friends/:id", auth, (c) => {
    removeFriend(db, currentUserId(c), c.req.param("id"));
    return c.json({ state: "none" });
  });

  app.get("/social/friends", auth, (c) => c.json(listFriends(db, currentUserId(c))));
  app.get("/social/requests", auth, (c) => c.json(listRequests(db, currentUserId(c))));
  app.get("/social/followers/:id", maybeAuth, (c) => c.json(listFollowers(db, c.req.param("id"))));
  app.get("/social/following/:id", maybeAuth, (c) => c.json(listFollowing(db, c.req.param("id"))));
  app.get("/social/feed", auth, (c) => c.json(feed(db, currentUserId(c), 40)));

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

  // ---- Community: Rollen, Beiträge, Abstimmung -----------------------
  app.get("/community/me", auth, (c) => {
    const userId = currentUserId(c);
    const mine = db
      .prepare("SELECT status, COUNT(*) AS n FROM contributions WHERE author_id = ? GROUP BY status")
      .all(userId) as { status: string; n: number }[];
    return c.json({ roles: rolesOf(db, userId), contributions: Object.fromEntries(mine.map((m) => [m.status, m.n])) });
  });

  app.post("/community/contributions", auth, async (c) => {
    const parsed = submitSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const result = submitContribution(db, currentUserId(c), parsed.data.payload, now(), community);
    return result.ok ? c.json({ id: result.id, status: "pending" }, 201) : c.json({ error: result.error }, result.status as 400);
  });

  app.get("/community/contributions", auth, (c) => {
    const status = c.req.query("status");
    const lang = c.req.query("lang");
    const mine = c.req.query("mine") === "1";
    const rows = listContributions(db, {
      status: (["pending", "verified", "rejected", "revoked"] as const).includes(status as never) ? (status as ContributionStatus) : undefined,
      lang: lang && isLangCode(lang) ? lang : undefined,
      mine: mine ? currentUserId(c) : undefined,
      limit: Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 50) || 50)),
    });
    return c.json(rows);
  });

  app.get("/community/contributions/:id", auth, (c) => {
    const id = Number(c.req.param("id"));
    const row = loadContribution(db, id);
    if (!row) return c.json({ error: "not found" }, 404);
    const userId = currentUserId(c);
    return c.json({
      id: row.id,
      kind: row.kind,
      lang: row.lang,
      payload: JSON.parse(row.payload) as unknown,
      status: row.status,
      decisionReason: row.decision_reason,
      votes: tally(db, id, userId),
      isAuthor: row.author_id === userId,
      canDecide: canDecide(db, userId, row.lang),
    });
  });

  app.post("/community/contributions/:id/vote", auth, async (c) => {
    const parsed = voteSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const result = vote(db, Number(c.req.param("id")), currentUserId(c), parsed.data.vote, now(), community);
    return result.ok ? c.json({ status: result.status }) : c.json({ error: result.error }, result.status as 400);
  });

  app.post("/community/contributions/:id/decide", auth, async (c) => {
    const parsed = decideSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const id = Number(c.req.param("id"));
    const row = loadContribution(db, id);
    if (!row) return c.json({ error: "not found" }, 404);
    if (!canDecide(db, currentUserId(c), row.lang)) return c.json({ error: "forbidden" }, 403);
    const result = decide(db, id, currentUserId(c), parsed.data.decision, now());
    return result.ok ? c.json({ status: result.status }) : c.json({ error: result.error }, result.status as 400);
  });

  // ---- Admin: Rollen vergeben -----------------------------------------
  app.post("/admin/roles", auth, async (c) => {
    if (!isAdmin(db, currentUserId(c))) return c.json({ error: "forbidden" }, 403);
    const parsed = grantSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    if (parsed.data.role === "expert" && !parsed.data.lang) return c.json({ error: "expert needs a language" }, 400);
    const target = db.prepare("SELECT id FROM users WHERE email = ?").get(parsed.data.email.toLowerCase()) as { id: string } | undefined;
    if (!target) return c.json({ error: "user not found" }, 404);
    grantRole(db, target.id, parsed.data.role, parsed.data.lang ?? "", now());
    return c.json({ ok: true, roles: rolesOf(db, target.id) }, 201);
  });

  app.delete("/admin/roles", auth, async (c) => {
    if (!isAdmin(db, currentUserId(c))) return c.json({ error: "forbidden" }, 403);
    const parsed = grantSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const target = db.prepare("SELECT id FROM users WHERE email = ?").get(parsed.data.email.toLowerCase()) as { id: string } | undefined;
    if (!target) return c.json({ error: "user not found" }, 404);
    revokeRole(db, target.id, parsed.data.role, parsed.data.lang ?? "");
    return c.json({ ok: true, roles: rolesOf(db, target.id) });
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
        owner: c.req.query("owner") || undefined,
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
