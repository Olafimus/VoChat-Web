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
import type { Db } from "./db/index.js";
import { browseLexemes, extractWords, languageStats, lexemeDetail, lexemesByIds, resolveWords, searchLexemes } from "./dictionary.js";
import { bodyLimit } from "hono/body-limit";
import { rateLimit } from "./ratelimit.js";
import { createUser, findUserByEmail, loadProfile, authResponse, setAvatarSecret, verifyAvatarSignature } from "./users.js";
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
  /** Geheimnis für signierte Links (Avatare). Ohne Angabe: zufällig je Prozess. */
  appSecret?: string;
  community?: CommunityOptions;
  /** Medien-Speicher (Profilbilder). `null`: Uploads sind deaktiviert. */
  media?: MediaStore | null;
  /** X-Real-IP vom vorgeschalteten Proxy vertrauen (nur hinter nginx o. Ä.). */
  trustProxy?: boolean;
  /** Anfragen pro Minute und Client für öffentliche, rechenintensive Endpunkte. */
  publicRateLimit?: number;
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

export function createApp({
  db,
  now = Date.now,
  corsOrigins = ["http://localhost:5173"],
  appSecret,
  community = DEFAULT_COMMUNITY,
  media = null,
  trustProxy = false,
  publicRateLimit = 120,
}: AppOptions): Hono {
  const app = new Hono();
  if (appSecret) setAvatarSecret(appSecret);
  const publicLimit = rateLimit({ windowMs: 60_000, max: publicRateLimit, trustProxy, name: "public" });
  const jsonLimit = (maxSize: number) =>
    bodyLimit({ maxSize, onError: (c) => c.json({ error: "payload too large" }, 413) });
  const loginAttempts = new Map<string, { count: number; resetAt: number }>();
  const pruneLoginAttempts = () => {
    if (loginAttempts.size < 10_000) return;
    for (const [k, v] of loginAttempts) if (v.resetAt <= now()) loginAttempts.delete(k);
  };

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
    if (await findUserByEmail(db, email)) return c.json({ error: "email already registered" }, 409);

    const passwordHash = await hashPassword(parsed.data.password);
    let userId: string;
    try {
      userId = await createUser(db, { email, name: parsed.data.name.trim(), nativeLang: parsed.data.nativeLang as LangCode, passwordHash }, now());
    } catch {
      return c.json({ error: "email already registered" }, 409); // gleichzeitige Registrierung
    }
    const token = await createSession(db, userId, now());
    return c.json(authResponse(token, (await loadProfile(db, userId))!), 201);
  });

  app.post("/auth/login", async (c) => {
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const email = parsed.data.email.trim().toLowerCase();

    const bucket = loginAttempts.get(email);
    if (bucket && bucket.resetAt > now() && bucket.count >= LOGIN_MAX_ATTEMPTS) {
      return c.json({ error: "too many attempts, try later" }, 429);
    }

    const user = await findUserByEmail(db, email);
    const ok = user ? await verifyPassword(parsed.data.password, user.password_hash) : false;
    if (!user || !ok) {
      const current = loginAttempts.get(email);
      pruneLoginAttempts();
      if (!current || current.resetAt <= now()) loginAttempts.set(email, { count: 1, resetAt: now() + LOGIN_WINDOW_MS });
      else current.count++;
      return c.json({ error: "invalid credentials" }, 401);
    }
    loginAttempts.delete(email);
    const token = await createSession(db, user.id, now());
    return c.json(authResponse(token, (await loadProfile(db, user.id))!));
  });

  const auth = requireAuth(db, now);
  const maybeAuth = optionalAuth(db, now);

  app.post("/auth/logout", auth, async (c) => {
    const token = (c.req.header("authorization") ?? "").slice(7).trim();
    await deleteSession(db, token);
    return c.json({ ok: true });
  });

  // ---- Profil -----------------------------------------------------------
  app.get("/me", auth, async (c) => {
    const profile = await loadProfile(db, currentUserId(c));
    return profile ? c.json(profile) : c.json({ error: "not found" }, 404);
  });

  app.patch("/me", auth, async (c) => {
    const parsed = profileUpdateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const userId = currentUserId(c);
    const d = parsed.data;
    await db.tx(async (t) => {
      if (d.name) await t.run("UPDATE users SET name = ? WHERE id = ?", [d.name.trim(), userId]);
      if (d.bio !== undefined) await t.run("UPDATE users SET bio = ? WHERE id = ?", [d.bio.trim(), userId]);
      if (d.profilePublic !== undefined) await t.run("UPDATE users SET profile_public = ? WHERE id = ?", [d.profilePublic ? 1 : 0, userId]);
      if (d.showProgress !== undefined) await t.run("UPDATE users SET show_progress = ? WHERE id = ?", [d.showProgress ? 1 : 0, userId]);
      if (d.nativeLang) await t.run("UPDATE users SET native_lang = ? WHERE id = ?", [d.nativeLang, userId]);
      if (d.learnLangs) {
        await t.run("DELETE FROM user_learn_langs WHERE user_id = ?", [userId]);
        const langs = [...new Map(d.learnLangs.map((l) => [l.lang, l])).values()];
        for (const l of langs) await t.run("INSERT INTO user_learn_langs (user_id, lang, target_cefr) VALUES (?, ?, ?)", [userId, l.lang, l.targetCefr]);
      }
    });
    return c.json(await loadProfile(db, userId));
  });

  // ---- Features & Medien ---------------------------------------------------
  app.get("/features", (c) => c.json({ avatars: media !== null, mediaDriver: media?.driver ?? null }));

  app.put("/me/avatar", auth, bodyLimit({ maxSize: MAX_AVATAR_BYTES + 1024, onError: (c) => c.json({ error: "image too large or empty" }, 413) }), async (c) => {
    if (!media) return c.json({ error: "media storage not configured" }, 503);
    const bytes = new Uint8Array(await c.req.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return c.json({ error: "image too large or empty" }, 413);
    const image = sniffImage(bytes);
    if (!image) return c.json({ error: "unsupported image type (png, jpeg, webp)" }, 415);
    const userId = currentUserId(c);
    const previous = await db.get<{ avatar_ext: string | null }>("SELECT avatar_ext FROM users WHERE id = ?", [userId]);
    await media.put(`avatars/${userId}.${image.ext}`, bytes, image.contentType);
    if (previous?.avatar_ext && previous.avatar_ext !== image.ext) await media.delete(`avatars/${userId}.${previous.avatar_ext}`);
    await db.run("UPDATE users SET avatar_ext = ?, avatar_version = avatar_version + 1 WHERE id = ?", [image.ext, userId]);
    return c.json(await loadProfile(db, userId));
  });

  app.delete("/me/avatar", auth, async (c) => {
    const userId = currentUserId(c);
    const row = await db.get<{ avatar_ext: string | null }>("SELECT avatar_ext FROM users WHERE id = ?", [userId]);
    if (media && row?.avatar_ext) await media.delete(`avatars/${userId}.${row.avatar_ext}`);
    await db.run("UPDATE users SET avatar_ext = NULL, avatar_version = avatar_version + 1 WHERE id = ?", [userId]);
    return c.json(await loadProfile(db, userId));
  });

  app.get("/media/avatars/:userId", maybeAuth, async (c) => {
    if (!media) return c.json({ error: "not found" }, 404);
    const id = c.req.param("userId");
    const row = await db.get<{ avatar_ext: string | null; avatar_version: number; profile_public: number }>(
      "SELECT avatar_ext, avatar_version, profile_public FROM users WHERE id = ?",
      [id],
    );
    if (!row?.avatar_ext) return c.json({ error: "not found" }, 404);
    const isPublic = Number(row.profile_public) === 1;
    // Sichtbar bei öffentlichem Profil, mit gültigem signiertem Link (den nur berechtigte Betrachter
    // über die API erhalten) oder für API-Clients mit passendem Token.
    const signed = verifyAvatarSignature(id, Number(row.avatar_version), c.req.query("s") ?? "");
    const viewer = maybeUserId(c);
    const visible = isPublic || signed || viewer === id || (viewer !== undefined && (await followState(db, viewer, id)) === "accepted");
    if (!visible) return c.json({ error: "not found" }, 404);
    const object = await media.get(`avatars/${id}.${row.avatar_ext}`);
    if (!object) return c.json({ error: "not found" }, 404);
    return new Response(object.body as unknown as BodyInit, {
      headers: { "content-type": object.contentType, "cache-control": `${isPublic ? "public" : "private"}, max-age=3600` },
    });
  });

  // ---- Öffentliche Profile & Social ---------------------------------------
  app.get("/users/:id", maybeAuth, async (c) => {
    const found = await publicUser(db, maybeUserId(c) ?? null, c.req.param("id"));
    return found ? c.json(found) : c.json({ error: "not found" }, 404);
  });

  app.get("/social/users", auth, async (c) => c.json(await searchUsers(db, currentUserId(c), c.req.query("q") ?? "")));

  app.post("/social/follow/:id", auth, async (c) => {
    const result = await follow(db, currentUserId(c), c.req.param("id"), now());
    return result.ok ? c.json({ state: result.state }) : c.json({ error: result.error }, result.status as 400);
  });
  app.delete("/social/follow/:id", auth, async (c) => {
    await unfollow(db, currentUserId(c), c.req.param("id"));
    return c.json({ state: "none" });
  });

  app.post("/social/follow-requests/:id/:action", auth, async (c) => {
    const action = c.req.param("action");
    if (action !== "accept" && action !== "decline") return c.json({ error: "invalid action" }, 400);
    const ok = await respondFollowRequest(db, currentUserId(c), c.req.param("id"), action === "accept");
    return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });

  app.post("/social/friends/:id", auth, async (c) => {
    const result = await requestFriend(db, currentUserId(c), c.req.param("id"), now());
    return result.ok ? c.json({ state: result.state }) : c.json({ error: result.error }, result.status as 400);
  });
  app.post("/social/friends/:id/:action", auth, async (c) => {
    const action = c.req.param("action");
    if (action !== "accept" && action !== "decline") return c.json({ error: "invalid action" }, 400);
    const ok = await respondFriendRequest(db, currentUserId(c), c.req.param("id"), action === "accept");
    return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });
  app.delete("/social/friends/:id", auth, async (c) => {
    await removeFriend(db, currentUserId(c), c.req.param("id"));
    return c.json({ state: "none" });
  });

  app.get("/social/friends", auth, async (c) => c.json(await listFriends(db, currentUserId(c))));
  app.get("/social/requests", auth, async (c) => c.json(await listRequests(db, currentUserId(c))));
  /** Listen nur, wenn das Profil öffentlich ist, man es selbst ist oder als Follower zugelassen wurde. */
  const canSeeConnections = async (viewer: string | undefined, target: string) => {
    if (viewer === target) return true;
    const u = await db.get<{ profile_public: number }>("SELECT profile_public FROM users WHERE id = ?", [target]);
    if (!u) return false;
    return Number(u.profile_public) === 1 || (viewer !== undefined && (await followState(db, viewer, target)) === "accepted");
  };
  app.get("/social/followers/:id", maybeAuth, async (c) => {
    if (!(await canSeeConnections(maybeUserId(c), c.req.param("id")))) return c.json({ error: "not found" }, 404);
    return c.json(await listFollowers(db, c.req.param("id")));
  });
  app.get("/social/following/:id", maybeAuth, async (c) => {
    if (!(await canSeeConnections(maybeUserId(c), c.req.param("id")))) return c.json({ error: "not found" }, 404);
    return c.json(await listFollowing(db, c.req.param("id")));
  });
  app.get("/social/feed", auth, async (c) => c.json(await feed(db, currentUserId(c), 40)));

  // ---- Sync -------------------------------------------------------------
  app.post("/sync/push", auth, jsonLimit(4 * 1024 * 1024), async (c) => {
    const parsed = pushRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    return c.json(await pushOps(db, currentUserId(c), parsed.data.ops));
  });

  app.get("/sync/changes", auth, async (c) => {
    const since = Math.max(0, Number(c.req.query("since") ?? 0) || 0);
    const limit = Math.min(500, Math.max(1, Number(c.req.query("limit") ?? 200) || 200));
    return c.json(await pullChanges(db, currentUserId(c), since, limit));
  });

  // ---- Wörterbuch (read-only, global) ----------------------------------
  app.get("/dictionary/languages", async (c) => c.json(await languageStats(db)));

  app.get("/dictionary/search", publicLimit, async (c) => {
    const lang = c.req.query("lang") ?? "";
    const q = c.req.query("q") ?? "";
    if (!isLangCode(lang) || q.length > 100) return c.json({ error: "invalid input" }, 400);
    const nativeLang = nativeParam(c.req.query("native"));
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20) || 20));
    return c.json(await searchLexemes(db, { lang, q, nativeLang, limit }));
  });

  app.get("/dictionary/browse", publicLimit, async (c) => {
    const lang = c.req.query("lang") ?? "";
    const cefr = c.req.query("cefr");
    if (!isLangCode(lang) || (cefr && !(CEFR_LEVELS as readonly string[]).includes(cefr))) {
      return c.json({ error: "invalid input" }, 400);
    }
    const nativeLang = nativeParam(c.req.query("native"));
    const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 50) || 50));
    const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
    return c.json(await browseLexemes(db, { lang, nativeLang, cefr: cefr as Cefr | undefined, limit, offset }));
  });

  /** Wörter aus einem Text (Chat-Nachricht, eingefügter Text) gegen das Wörterbuch abgleichen. */
  app.post("/dictionary/extract", publicLimit, jsonLimit(256 * 1024), async (c) => {
    const body = (await c.req.json().catch(() => null)) as { lang?: string; text?: string } | null;
    if (!body || !isLangCode(body.lang ?? "") || typeof body.text !== "string" || body.text.length > 100_000) {
      return c.json({ error: "invalid input" }, 400);
    }
    const nativeLang = nativeParam(c.req.query("native"));
    return c.json(await extractWords(db, body.lang as LangCode, body.text, nativeLang));
  });

  /** Wörter zu Wörterbuch-Einträgen auflösen (automatisches Verknüpfen eigener Vokabeln und Sammlungen). */
  app.post("/dictionary/resolve", publicLimit, jsonLimit(256 * 1024), async (c) => {
    const body = (await c.req.json().catch(() => null)) as { lang?: string; words?: unknown } | null;
    const words = Array.isArray(body?.words) ? (body!.words as unknown[]).filter((w): w is string => typeof w === "string" && w.length <= 200) : null;
    if (!body || !isLangCode(body.lang ?? "") || !words || words.length > 500) return c.json({ error: "invalid input" }, 400);
    const resolved = await resolveWords(db, body.lang as LangCode, words, nativeParam(c.req.query("native")));
    return c.json(Object.fromEntries(resolved));
  });

  /** Mehrere Einträge auf einmal (Aktualisieren verknüpfter Karten). */
  app.post("/dictionary/lexemes/batch", publicLimit, jsonLimit(64 * 1024), async (c) => {
    const body = (await c.req.json().catch(() => null)) as { ids?: unknown } | null;
    const ids = Array.isArray(body?.ids) ? (body!.ids as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0) : null;
    if (!ids || ids.length > 500) return c.json({ error: "invalid input" }, 400);
    return c.json(await lexemesByIds(db, ids, nativeParam(c.req.query("native"))));
  });

  app.get("/dictionary/lexemes/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
    const nativeLang = nativeParam(c.req.query("native"));
    const detail = await lexemeDetail(db, id, nativeLang);
    return detail ? c.json(detail) : c.json({ error: "not found" }, 404);
  });

  // ---- Community: Rollen, Beiträge, Abstimmung -----------------------
  app.get("/community/me", auth, async (c) => {
    const userId = currentUserId(c);
    const mine = await db.all<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM contributions WHERE author_id = ? GROUP BY status", [userId]);
    return c.json({ roles: await rolesOf(db, userId), contributions: Object.fromEntries(mine.map((m) => [m.status, Number(m.n)])) });
  });

  app.post("/community/contributions", auth, jsonLimit(64 * 1024), async (c) => {
    const parsed = submitSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const result = await submitContribution(db, currentUserId(c), parsed.data.payload, now(), community);
    return result.ok ? c.json({ id: result.id, status: "pending" }, 201) : c.json({ error: result.error }, result.status as 400);
  });

  app.get("/community/contributions", auth, async (c) => {
    const status = c.req.query("status");
    const lang = c.req.query("lang");
    const mine = c.req.query("mine") === "1";
    const rows = await listContributions(db, {
      status: (["pending", "verified", "rejected", "revoked"] as const).includes(status as never) ? (status as ContributionStatus) : undefined,
      lang: lang && isLangCode(lang) ? lang : undefined,
      mine: mine ? currentUserId(c) : undefined,
      limit: Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 50) || 50)),
    });
    return c.json(rows);
  });

  app.get("/community/contributions/:id", auth, async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "not found" }, 404);
    const row = await loadContribution(db, id);
    if (!row) return c.json({ error: "not found" }, 404);
    const userId = currentUserId(c);
    return c.json({
      id: row.id,
      kind: row.kind,
      lang: row.lang,
      payload: JSON.parse(row.payload) as unknown,
      status: row.status,
      decisionReason: row.decision_reason,
      votes: await tally(db, id, userId),
      isAuthor: row.author_id === userId,
      canDecide: await canDecide(db, userId, row.lang),
    });
  });

  app.post("/community/contributions/:id/vote", auth, async (c) => {
    const parsed = voteSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "not found" }, 404);
    const result = await vote(db, id, currentUserId(c), parsed.data.vote, now(), community);
    return result.ok ? c.json({ status: result.status }) : c.json({ error: result.error }, result.status as 400);
  });

  app.post("/community/contributions/:id/decide", auth, async (c) => {
    const parsed = decideSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const id = Number(c.req.param("id"));
    const row = Number.isInteger(id) ? await loadContribution(db, id) : undefined;
    if (!row) return c.json({ error: "not found" }, 404);
    if (!(await canDecide(db, currentUserId(c), row.lang))) return c.json({ error: "forbidden" }, 403);
    const result = await decide(db, id, currentUserId(c), parsed.data.decision, now());
    return result.ok ? c.json({ status: result.status }) : c.json({ error: result.error }, result.status as 400);
  });

  // ---- Admin: Rollen vergeben -----------------------------------------
  app.post("/admin/roles", auth, async (c) => {
    if (!(await isAdmin(db, currentUserId(c)))) return c.json({ error: "forbidden" }, 403);
    const parsed = grantSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    if (parsed.data.role === "expert" && !parsed.data.lang) return c.json({ error: "expert needs a language" }, 400);
    const target = await db.get<{ id: string }>("SELECT id FROM users WHERE email = ?", [parsed.data.email.toLowerCase()]);
    if (!target) return c.json({ error: "user not found" }, 404);
    await grantRole(db, target.id, parsed.data.role, parsed.data.lang ?? "", now());
    return c.json({ ok: true, roles: await rolesOf(db, target.id) }, 201);
  });

  app.delete("/admin/roles", auth, async (c) => {
    if (!(await isAdmin(db, currentUserId(c)))) return c.json({ error: "forbidden" }, 403);
    const parsed = grantSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const target = await db.get<{ id: string }>("SELECT id FROM users WHERE email = ?", [parsed.data.email.toLowerCase()]);
    if (!target) return c.json({ error: "user not found" }, 404);
    await revokeRole(db, target.id, parsed.data.role, parsed.data.lang ?? "");
    return c.json({ ok: true, roles: await rolesOf(db, target.id) });
  });

  // ---- Katalog: Lernpfade & Medien-Sammlungen (öffentlich lesbar) ------
  app.get("/catalog/paths", async (c) => {
    const lang = c.req.query("lang") ?? "";
    if (!isLangCode(lang)) return c.json({ error: "invalid input" }, 400);
    return c.json(await builtinPaths(db, lang));
  });

  app.get("/catalog/paths/:id", publicLimit, async (c) => {
    const detail = await builtinPathDetail(db, c.req.param("id"), nativeParam(c.req.query("native")));
    return detail ? c.json(detail) : c.json({ error: "not found" }, 404);
  });

  app.get("/catalog/collections", publicLimit, async (c) => {
    const kind = c.req.query("kind");
    const lang = c.req.query("lang");
    const sort = c.req.query("sort") === "rating" ? "rating" : "new";
    const items = await listPublicCollections(
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

  app.get("/catalog/collections/:id", maybeAuth, async (c) => {
    const found = await getPublicCollection(db, c.req.param("id"));
    if (!found) return c.json({ error: "not found" }, 404);
    const userId = maybeUserId(c);
    return c.json({ ...found, myRating: userId ? await myRating(db, found.id, userId) : null });
  });

  app.put("/catalog/collections/:id/rating", auth, async (c) => {
    const parsed = ratingSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const ok = await upsertRating(db, c.req.param("id"), currentUserId(c), parsed.data.difficulty, now());
    return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });

  return app;
}

function nativeParam(value: string | undefined): LangCode {
  return value && isLangCode(value) ? value : "de";
}
