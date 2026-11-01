import { Hono, type Context } from "hono";
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
import { normalizeTtsText, Tts } from "./tts.js";
import { notifications } from "./notifications.js";
import { logAudit } from "./audit.js";
import { streamSSE } from "hono/streaming";
import {
  chatMediaByFile,
  ChatHub,
  correctMessage,
  createGroup,
  deleteMessage,
  editMessage,
  listConversations,
  listMessages,
  markRead,
  MAX_IMAGE_BYTES,
  memberIds,
  messagesByIds,
  openDm,
  sendMedia,
  sendText,
  toggleReaction,
} from "./chat.js";
import { verifyMediaSignature } from "./users.js";
import { deleteRecording, MAX_RECORDING_BYTES, recordingByFile, recordingOwner, recordingsFor, saveRecording } from "./recordings.js";
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
import { auditHistory } from "./audit.js";
import { expertAction, reviewQueue, reviewStats, type ExpertAction, type QueueFilter } from "./expert.js";
import { addComment, COMMENT_TARGETS, deleteComment, editComment, listComments, voteComment, type CommentTarget } from "./comments.js";
import { reputation } from "./reputation.js";
import { challengeDetail, createChallenge, joinWeekly, leaveChallenge, listChallenges, respondChallenge, weeklyChallenge } from "./challenges.js";
import { challengeCreateSchema } from "@vochat/shared";

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
  /** Sprachsynthese für Wörter ohne Aufnahme; `null` schaltet sie ab. */
  tts?: Tts | null;
  /** Echtzeit-Verteiler für Chats (Standard: neu je App). */
  chatHub?: ChatHub;
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
  tts = new Tts(),
  chatHub = new ChatHub(),
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
    if (!found) return c.json({ error: "not found" }, 404);
    // Punkte sind öffentlich, wenn auch das Profil sichtbar ist (gleiche Regel wie die Statistik).
    return c.json({ ...found, score: found.stats ? (await reputation(db, found.id)).score : null });
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

  app.get("/notifications", auth, async (c) => c.json(await notifications(db, currentUserId(c), now())));

  // ---- Chats zwischen Nutzern ---------------------------------------------
  const notify = async (conversationId: string, event: Parameters<ChatHub["publish"]>[1]) =>
    chatHub.publish(await memberIds(db, conversationId), event);

  app.get("/conversations", auth, async (c) => c.json(await listConversations(db, currentUserId(c))));

  app.post("/conversations", auth, jsonLimit(8 * 1024), async (c) => {
    const body = (await c.req.json().catch(() => null)) as { userId?: unknown; title?: unknown; members?: unknown } | null;
    const me = currentUserId(c);
    const result =
      typeof body?.userId === "string"
        ? await openDm(db, me, body.userId, now())
        : Array.isArray(body?.members) && typeof body?.title === "string"
          ? await createGroup(db, me, body.title, body.members.filter((m): m is string => typeof m === "string"), now())
          : ({ ok: false, status: 400, error: "invalid input" } as const);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    await notify(result.id, { type: "conversation", conversationId: result.id });
    return c.json({ id: result.id }, 201);
  });

  app.get("/conversations/:id/messages", auth, async (c) => {
    const num = (v: string | undefined) => (v !== undefined && /^\d{1,9}$/.test(v) ? Number(v) : undefined);
    const ids = c.req.query("ids");
    const list = ids
      ? await messagesByIds(db, currentUserId(c), c.req.param("id"), ids.split(",").filter((x) => /^\d{1,9}$/.test(x)).map(Number))
      : await listMessages(db, currentUserId(c), c.req.param("id"), {
          before: num(c.req.query("before")),
          after: num(c.req.query("after")),
          limit: num(c.req.query("limit")) ?? 50,
        });
    return list ? c.json(list) : c.json({ error: "not found" }, 404);
  });

  app.post("/conversations/:id/messages", auth, jsonLimit(32 * 1024), async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    const result = await sendText(db, currentUserId(c), id, body ?? {}, now());
    if (!result.ok) return c.json({ error: result.error }, result.status);
    await notify(id, { type: "message", conversationId: id, messageId: result.message.id });
    return c.json(result.message, 201);
  });

  // Bild oder Sprachnachricht: Rohdaten im Body, Metadaten in der Query
  app.post(
    "/conversations/:id/media",
    auth,
    bodyLimit({ maxSize: MAX_IMAGE_BYTES, onError: (c) => c.json({ error: "file too large" }, 413) }),
    async (c) => {
      if (!media) return c.json({ error: "media storage not configured" }, 503);
      const id = c.req.param("id");
      const q = (k: string) => c.req.query(k);
      const int = (v: string | undefined) => (v && /^\d{1,9}$/.test(v) ? Number(v) : null);
      const kind = q("kind") === "voice" ? "voice" : q("kind") === "image" ? "image" : null;
      if (!kind) return c.json({ error: "kind must be image or voice" }, 400);
      const result = await sendMedia(
        db,
        media,
        currentUserId(c),
        id,
        {
          kind,
          bytes: new Uint8Array(await c.req.arrayBuffer()),
          caption: (q("caption") ?? "").slice(0, 1000),
          durationMs: int(q("durationMs")),
          width: int(q("width")),
          height: int(q("height")),
          replyTo: int(q("replyTo")),
          clientId: q("clientId") && /^[\w-]{8,64}$/.test(q("clientId")!) ? q("clientId")! : null,
        },
        now(),
      );
      if (!result.ok) return c.json({ error: result.error }, result.status);
      await notify(id, { type: "message", conversationId: id, messageId: result.message.id });
      return c.json(result.message, 201);
    },
  );

  // Nachrichten-IDs: nur Ganzzahlen im INTEGER-Bereich, sonst 404
  app.use("/messages/:id/*", async (c, next) => (/^\d{1,9}$/.test(c.req.param("id") ?? "") ? next() : c.json({ error: "not found" }, 404)));
  app.use("/messages/:id", async (c, next) => (/^\d{1,9}$/.test(c.req.param("id") ?? "") ? next() : c.json({ error: "not found" }, 404)));

  app.patch("/messages/:id", auth, jsonLimit(32 * 1024), async (c) => {
    const body = (await c.req.json().catch(() => null)) as { body?: unknown } | null;
    const result = await editMessage(db, currentUserId(c), Number(c.req.param("id")), body?.body, now());
    if (!result.ok) return c.json({ error: result.error }, result.status);
    await notify(result.message.conversationId, { type: "update", conversationId: result.message.conversationId, messageId: result.message.id });
    return c.json(result.message);
  });

  app.delete("/messages/:id", auth, async (c) => {
    const id = Number(c.req.param("id"));
    const result = await deleteMessage(db, media, currentUserId(c), id);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    await notify(result.conversationId, { type: "update", conversationId: result.conversationId, messageId: id });
    return c.json({ ok: true });
  });

  app.post("/messages/:id/reactions", auth, jsonLimit(1024), async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => null)) as { emoji?: unknown } | null;
    const result = await toggleReaction(db, currentUserId(c), id, body?.emoji, now());
    if (!result.ok) return c.json({ error: result.error }, result.status);
    await notify(result.conversationId, { type: "update", conversationId: result.conversationId, messageId: id });
    return c.json({ ok: true });
  });

  app.post("/messages/:id/correction", auth, jsonLimit(32 * 1024), async (c) => {
    const id = Number(c.req.param("id"));
    const body = (await c.req.json().catch(() => null)) as { body?: unknown } | null;
    const result = await correctMessage(db, currentUserId(c), id, body?.body);
    if (!result.ok) return c.json({ error: result.error }, result.status);
    await notify(result.conversationId, { type: "update", conversationId: result.conversationId, messageId: id });
    return c.json({ ok: true });
  });

  app.post("/conversations/:id/read", auth, jsonLimit(1024), async (c) => {
    const id = c.req.param("id");
    const body = (await c.req.json().catch(() => null)) as { messageId?: unknown } | null;
    const messageId = Number(body?.messageId);
    if (!Number.isInteger(messageId) || messageId < 0) return c.json({ error: "invalid input" }, 400);
    const me = currentUserId(c);
    if (!(await markRead(db, me, id, messageId))) return c.json({ error: "not found" }, 404);
    await notify(id, { type: "read", conversationId: id, userId: me, messageId });
    return c.json({ ok: true });
  });

  app.get("/media/chat/:file", async (c) => {
    if (!media) return c.json({ error: "not found" }, 404);
    const file = c.req.param("file");
    if (!/^[0-9a-f]{32}\.(png|jpg|webp|gif|webm|ogg|m4a|wav|mp3)$/.test(file)) return c.json({ error: "not found" }, 404);
    const key = `chat/${file}`;
    if (!verifyMediaSignature(key, c.req.query("s") ?? "")) return c.json({ error: "not found" }, 404);
    if (!(await chatMediaByFile(db, file))) return c.json({ error: "not found" }, 404);
    const object = await media.get(key);
    if (!object) return c.json({ error: "not found" }, 404);
    return new Response(object.body as unknown as BodyInit, {
      headers: {
        "content-type": object.contentType,
        "cache-control": "private, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; sandbox",
      },
    });
  });

  /** Echtzeit-Ereignisse (Server-Sent Events). Der Client verbindet sich per fetch mit Bearer-Token. */
  app.get("/events", auth, (c) => {
    const me = currentUserId(c);
    return streamSSE(c, async (stream) => {
      const queue: string[] = [];
      let wake: (() => void) | null = null;
      const unsubscribe = chatHub.subscribe(me, (e) => {
        queue.push(JSON.stringify(e));
        wake?.();
      });
      stream.onAbort(() => {
        unsubscribe();
        wake?.();
      });
      await stream.writeSSE({ event: "ready", data: "{}" });
      while (!stream.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
            setTimeout(resolve, 25_000); // Lebenszeichen gegen Proxy-Timeouts
          });
          wake = null;
        }
        if (stream.aborted) break;
        if (queue.length === 0) await stream.writeSSE({ event: "ping", data: "{}" });
        while (queue.length) await stream.writeSSE({ event: "chat", data: queue.shift()! });
      }
      unsubscribe();
    });
  });

  // ---- Aussprache: Aufnahmen, sonst erzeugt -----------------------------
  app.get("/audio/lexemes/:id", maybeAuth, async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
    const viewer = maybeUserId(c) ?? null;
    if (!viewer) {
      c.header("cache-control", "public, max-age=600");
      return c.json({ recordings: await recordingsFor(db, id, null), uploads: media !== null });
    }
    const lang = (await db.get<{ lang: string }>("SELECT lang FROM lexemes WHERE id = ?", [id]))?.lang ?? "";
    const moderator = isLangCode(lang) && (await canDecide(db, viewer, lang));
    c.header("cache-control", "private, no-store");
    return c.json({ recordings: await recordingsFor(db, id, viewer, moderator), uploads: media !== null });
  });

  // Eigene Aufnahme hochladen (Rohdaten im Body, höchstens 256 KB)
  app.post(
    "/audio/lexemes/:id/recordings",
    auth,
    bodyLimit({ maxSize: MAX_RECORDING_BYTES, onError: (c) => c.json({ error: "recording too large" }, 413) }),
    async (c) => {
      if (!media) return c.json({ error: "recordings are not enabled on this server" }, 503);
      const id = Number(c.req.param("id"));
      if (!Number.isInteger(id) || id <= 0) return c.json({ error: "invalid id" }, 400);
      const userId = currentUserId(c);
      const lang = (await db.get<{ lang: string }>("SELECT lang FROM lexemes WHERE id = ?", [id]))?.lang ?? "";
      const duration = Number(c.req.header("x-duration-ms"));
      const result = await saveRecording(
        db,
        media,
        {
          userId,
          lexemeId: id,
          bytes: new Uint8Array(await c.req.arrayBuffer()),
          durationMs: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null,
          autoApprove: isLangCode(lang) && (await canDecide(db, userId, lang)),
        },
        now(),
      );
      if (!result.ok) return c.json({ error: result.error }, result.status);
      await logAudit(db, { actorId: userId, action: "recording.add", lang, lexemeId: id, itemType: "recording", itemId: String(result.recording.id), details: { status: result.recording.status } }, now());
      return c.json(result.recording, 201);
    },
  );

  app.delete("/audio/recordings/:id", auth, async (c) => {
    const id = Number(c.req.param("id"));
    const row = Number.isInteger(id) ? await recordingOwner(db, id) : undefined;
    if (!row) return c.json({ error: "not found" }, 404);
    const userId = currentUserId(c);
    const allowed = row.user_id === userId || (isLangCode(row.lang) && (await canDecide(db, userId, row.lang)));
    if (!allowed || !row.media_key) return c.json({ error: "forbidden" }, 403);
    await deleteRecording(db, media, id);
    await logAudit(db, { actorId: userId, action: "recording.delete", lang: row.lang, lexemeId: Number(row.lexeme_id), itemType: "recording", itemId: String(id), details: {} }, now());
    return c.json({ ok: true });
  });

  app.get("/media/recordings/:file", async (c) => {
    if (!media) return c.json({ error: "not found" }, 404);
    const file = c.req.param("file");
    if (!/^\d+-[0-9a-f]{24}\.(webm|ogg|m4a|wav|mp3)$/.test(file)) return c.json({ error: "not found" }, 404);
    const row = await recordingByFile(db, file);
    if (!row || row.status === "hidden") return c.json({ error: "not found" }, 404);
    const object = await media.get(row.media_key);
    if (!object) return c.json({ error: "not found" }, 404);
    // Unveränderlich (neue Aufnahme = neuer Dateiname); ausstehende nur kurz cachen.
    const cache = row.status === "approved" ? "public, max-age=31536000, immutable" : "private, max-age=60";
    return new Response(object.body as unknown as BodyInit, { headers: { "content-type": object.contentType, "cache-control": cache } });
  });

  app.get("/audio/tts", publicLimit, async (c) => {
    const lang = c.req.query("lang") ?? "";
    const text = normalizeTtsText(c.req.query("text") ?? "");
    if (!isLangCode(lang) || !text) return c.json({ error: "lang and text required" }, 400);
    if (!tts) return c.json({ error: "speech synthesis disabled" }, 503);
    const wav = await tts.synthesize(lang, text, c.req.query("slow") === "1");
    if (!wav) return c.json({ error: "nothing to say" }, 422);
    return c.body(wav as Uint8Array<ArrayBuffer>, 200, {
      "content-type": "audio/wav",
      "cache-control": "public, max-age=31536000, immutable",
      "x-audio-source": "espeak-ng",
    });
  });

  app.get("/audio/ipa", publicLimit, async (c) => {
    const lang = c.req.query("lang") ?? "";
    const text = c.req.query("text") ?? "";
    if (!isLangCode(lang) || !text.trim()) return c.json({ error: "lang and text required" }, 400);
    if (!tts) return c.json({ error: "speech synthesis disabled" }, 503);
    c.header("cache-control", "public, max-age=86400");
    return c.json({ ipa: await tts.ipa(lang, text), generated: true });
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
    return c.json({
      roles: await rolesOf(db, userId),
      contributions: Object.fromEntries(mine.map((m) => [m.status, Number(m.n)])),
      reputation: await reputation(db, userId),
    });
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

  // ---- Expertenprüfung: Warteschlange, Aktionen, Protokoll --------------
  const requireReviewer = async (c: Context, lang: string) => isLangCode(lang) && (await canDecide(db, currentUserId(c), lang));

  app.get("/review/queue", auth, async (c) => {
    const lang = c.req.query("lang") ?? "";
    if (!(await requireReviewer(c, lang))) return c.json({ error: "forbidden" }, 403);
    const filter = (["open", "suspicious", "needs_fix", "approved", "recordings"] as const).includes(c.req.query("filter") as never)
      ? (c.req.query("filter") as QueueFilter)
      : "open";
    const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20) || 20));
    const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
    return c.json({
      stats: await reviewStats(db, lang as LangCode),
      entries: await reviewQueue(db, { lang: lang as LangCode, filter, limit, offset }),
    });
  });

  app.post("/review/lexemes/:id", auth, jsonLimit(16 * 1024), async (c) => {
    const id = Number(c.req.param("id"));
    const lexeme = Number.isInteger(id) ? await db.get<{ lang: string }>("SELECT lang FROM lexemes WHERE id = ?", [id]) : undefined;
    if (!lexeme) return c.json({ error: "not found" }, 404);
    if (!(await requireReviewer(c, lexeme.lang))) return c.json({ error: "forbidden" }, 403);
    const body = (await c.req.json().catch(() => null)) as ExpertAction | null;
    const valid =
      body &&
      ((body.action === "approve") ||
        (body.action === "flag" && typeof body.note === "string" && body.note.trim().length > 0 && body.note.length <= 500) ||
        (body.action === "hideSense" && Number.isInteger(body.senseId)) ||
        (body.action === "editSense" && Number.isInteger(body.senseId) && typeof body.gloss === "string" && body.gloss.trim() && body.gloss.length <= 500) ||
        (body.action === "addSense" && typeof body.gloss === "string" && body.gloss.length <= 500 && typeof body.glossLang === "string") ||
        (body.action === "addTranslation" && typeof body.targetLemma === "string" && body.targetLemma.length <= 200 && typeof body.targetLang === "string") ||
        (body.action === "hideTranslation" && Number.isInteger(body.translationId)) ||
        ((body.action === "approveRecording" || body.action === "hideRecording") && Number.isInteger(body.recordingId)) ||
        (body.action === "setPronunciation" && (body.romanization === null || (typeof body.romanization === "string" && body.romanization.length <= 200))));
    if (!valid) return c.json({ error: "invalid input" }, 400);
    const result = await expertAction(db, currentUserId(c), id, body, now());
    return result.ok ? c.json(result) : c.json({ error: result.error }, result.status as 400);
  });

  /** Verlauf eines Eintrags (wer hat wann was geändert/geprüft) – öffentlich nachvollziehbar. */
  app.get("/history/lexemes/:id", async (c) => {
    const id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "invalid id" }, 400);
    return c.json(await auditHistory(db, { lexemeId: id }, 100));
  });

  // ---- Kommentare (Baum) mit Bewertungen -------------------------------
  const parseTarget = (raw: string | undefined): { type: CommentTarget; id: string } | null => {
    const [type, ...rest] = (raw ?? "").split(":");
    const id = rest.join(":");
    return (COMMENT_TARGETS as readonly string[]).includes(type) && id ? { type: type as CommentTarget, id } : null;
  };
  app.get("/comments", auth, async (c) => {
    const target = parseTarget(c.req.query("target"));
    if (!target) return c.json({ error: "invalid target" }, 400);
    return c.json(await listComments(db, currentUserId(c), target.type, target.id));
  });
  app.post("/comments", auth, jsonLimit(16 * 1024), async (c) => {
    const body = (await c.req.json().catch(() => null)) as { target?: string; parentId?: number | null; body?: string } | null;
    const target = parseTarget(body?.target);
    if (!target || typeof body?.body !== "string") return c.json({ error: "invalid input" }, 400);
    const parentId = body.parentId === undefined || body.parentId === null ? null : Number(body.parentId);
    const result = await addComment(db, currentUserId(c), { ...target, parentId, body: body.body }, now());
    return result.ok ? c.json({ id: result.id }, 201) : c.json({ error: result.error }, result.status as 400);
  });
  app.post("/comments/:id/vote", auth, async (c) => {
    const body = (await c.req.json().catch(() => null)) as { value?: number } | null;
    const value = Number(body?.value);
    if (![-1, 0, 1].includes(value)) return c.json({ error: "invalid input" }, 400);
    const result = await voteComment(db, currentUserId(c), Number(c.req.param("id")), value, now());
    return result.ok ? c.json({ ok: true }) : c.json({ error: result.error }, result.status as 400);
  });
  app.patch("/comments/:id", auth, jsonLimit(16 * 1024), async (c) => {
    const body = (await c.req.json().catch(() => null)) as { body?: string } | null;
    const ok = typeof body?.body === "string" && (await editComment(db, currentUserId(c), Number(c.req.param("id")), body.body, now()));
    return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });
  app.delete("/comments/:id", auth, async (c) => {
    const ok = await deleteComment(db, currentUserId(c), await isAdmin(db, currentUserId(c)), Number(c.req.param("id")));
    return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });

  // ---- Gemeinsam lernen: Challenges ------------------------------------
  app.get("/challenges", auth, async (c) => c.json(await listChallenges(db, currentUserId(c))));
  app.get("/challenges/weekly", auth, async (c) => {
    const lang = c.req.query("lang") ?? "";
    if (!isLangCode(lang)) return c.json({ error: "invalid input" }, 400);
    const id = await weeklyChallenge(db, lang, now());
    return id ? c.json(await challengeDetail(db, currentUserId(c), id)) : c.json(null);
  });
  app.post("/challenges", auth, jsonLimit(256 * 1024), async (c) => {
    const parsed = challengeCreateSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "invalid input" }, 400);
    const result = await createChallenge(db, currentUserId(c), { ...parsed.data, lang: parsed.data.lang as LangCode }, now());
    return result.ok ? c.json({ id: result.id }, 201) : c.json({ error: result.error }, result.status as 400);
  });
  app.get("/challenges/:id", auth, async (c) => {
    const detail = await challengeDetail(db, currentUserId(c), c.req.param("id"));
    return detail ? c.json(detail) : c.json({ error: "not found" }, 404);
  });
  app.post("/challenges/:id/:action", auth, async (c) => {
    const action = c.req.param("action");
    const id = c.req.param("id");
    const userId = currentUserId(c);
    if (action === "accept" || action === "decline") {
      return (await respondChallenge(db, userId, id, action === "accept", now())) ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
    }
    if (action === "join") return (await joinWeekly(db, userId, id, now())) ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
    if (action === "leave") {
      await leaveChallenge(db, userId, id);
      return c.json({ ok: true });
    }
    return c.json({ error: "invalid action" }, 400);
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
