import type { FeedItem, FollowState, FriendState, PublicUser } from "@vochat/shared";
import type { Db } from "./db/index.js";
import { avatarUrl } from "./users.js";

interface UserRow {
  id: string;
  name: string;
  bio: string;
  avatar_ext: string | null;
  avatar_version: number;
  profile_public: number;
  show_progress: number;
}

type ActionResult<T> = { ok: true; state: T } | { ok: false; status: number; error: string };

const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]);
const marks = (n: number) => Array.from({ length: n }, () => "?").join(",");
const count = async (db: Db, sql: string, params: (string | number)[]) => Number((await db.get<{ n: number }>(sql, params))?.n ?? 0);

export async function followState(db: Db, follower: string, followee: string): Promise<FollowState> {
  const row = await db.get<{ status: string }>("SELECT status FROM follows WHERE follower_id = ? AND followee_id = ?", [follower, followee]);
  return row ? (row.status as FollowState) : "none";
}

export async function friendState(db: Db, me: string, other: string): Promise<FriendState> {
  const [low, high] = pair(me, other);
  const row = await db.get<{ status: string; requested_by: string }>(
    "SELECT status, requested_by FROM friendships WHERE user_low = ? AND user_high = ?",
    [low, high],
  );
  if (!row) return "none";
  if (row.status === "accepted") return "accepted";
  return row.requested_by === me ? "outgoing" : "incoming";
}

/** Folgen: öffentliche Profile sofort, private nur mit Zustimmung. */
export async function follow(db: Db, me: string, target: string, now: number): Promise<ActionResult<FollowState>> {
  if (me === target) return { ok: false, status: 400, error: "cannot follow yourself" };
  const user = await db.get<{ profile_public: number }>("SELECT profile_public FROM users WHERE id = ?", [target]);
  if (!user) return { ok: false, status: 404, error: "not found" };
  const existing = await followState(db, me, target);
  if (existing !== "none") return { ok: true, state: existing };
  const status: FollowState = Number(user.profile_public) === 1 ? "accepted" : "requested";
  await db.run("INSERT INTO follows (follower_id, followee_id, status, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING", [
    me,
    target,
    status,
    now,
  ]);
  return { ok: true, state: status };
}

export async function unfollow(db: Db, me: string, target: string): Promise<void> {
  await db.run("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?", [me, target]);
}

export async function respondFollowRequest(db: Db, me: string, follower: string, accept: boolean): Promise<boolean> {
  const row = await db.get<{ status: string }>("SELECT status FROM follows WHERE follower_id = ? AND followee_id = ?", [follower, me]);
  if (!row || row.status !== "requested") return false;
  if (accept) await db.run("UPDATE follows SET status = 'accepted' WHERE follower_id = ? AND followee_id = ?", [follower, me]);
  else await db.run("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?", [follower, me]);
  return true;
}

/** Freundschaftsanfrage. Hat der andere schon angefragt, wird daraus eine Freundschaft. */
export async function requestFriend(db: Db, me: string, other: string, now: number): Promise<ActionResult<FriendState>> {
  if (me === other) return { ok: false, status: 400, error: "cannot befriend yourself" };
  if (!(await db.get("SELECT 1 AS ok FROM users WHERE id = ?", [other]))) return { ok: false, status: 404, error: "not found" };
  const [low, high] = pair(me, other);
  const current = await friendState(db, me, other);
  if (current === "accepted" || current === "outgoing") return { ok: true, state: current };
  if (current === "incoming") {
    await db.run("UPDATE friendships SET status = 'accepted' WHERE user_low = ? AND user_high = ?", [low, high]);
    return { ok: true, state: "accepted" };
  }
  await db.run(
    "INSERT INTO friendships (user_low, user_high, status, requested_by, created_at) VALUES (?, ?, 'pending', ?, ?) ON CONFLICT DO NOTHING",
    [low, high, me, now],
  );
  return { ok: true, state: "outgoing" };
}

export async function respondFriendRequest(db: Db, me: string, other: string, accept: boolean): Promise<boolean> {
  const [low, high] = pair(me, other);
  if ((await friendState(db, me, other)) !== "incoming") return false;
  if (accept) await db.run("UPDATE friendships SET status = 'accepted' WHERE user_low = ? AND user_high = ?", [low, high]);
  else await db.run("DELETE FROM friendships WHERE user_low = ? AND user_high = ?", [low, high]);
  return true;
}

export async function removeFriend(db: Db, me: string, other: string): Promise<void> {
  const [low, high] = pair(me, other);
  await db.run("DELETE FROM friendships WHERE user_low = ? AND user_high = ?", [low, high]);
}

export async function friendIds(db: Db, me: string): Promise<string[]> {
  const rows = await db.all<{ other: string }>(
    `SELECT CASE WHEN user_low = ? THEN user_high ELSE user_low END AS other
     FROM friendships WHERE status = 'accepted' AND (user_low = ? OR user_high = ?)`,
    [me, me, me],
  );
  return rows.map((r) => r.other);
}

export async function followingIds(db: Db, me: string): Promise<string[]> {
  return (await db.all<{ id: string }>("SELECT followee_id AS id FROM follows WHERE follower_id = ? AND status = 'accepted'", [me])).map((r) => r.id);
}

/** Kurzprofile für mehrere Nutzer in einer Abfrage, Reihenfolge wie übergeben. */
async function summaries(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  const rows = await db.all<{ id: string; name: string; avatar_ext: string | null; avatar_version: number; profile_public: number }>(
    `SELECT id, name, avatar_ext, avatar_version, profile_public FROM users WHERE id IN (${marks(ids.length)})`,
    ids,
  );
  const byId = new Map(rows.map((u) => [u.id, u]));
  return ids
    .map((id) => byId.get(id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => ({ id: u.id, name: u.name, avatarUrl: avatarUrl(u), isPrivate: Number(u.profile_public) === 0 }));
}

export async function listFriends(db: Db, me: string) {
  return summaries(db, await friendIds(db, me));
}

export async function listRequests(db: Db, me: string) {
  const incomingFriends = await db.all<{ id: string }>(
    `SELECT CASE WHEN user_low = ? THEN user_high ELSE user_low END AS id
     FROM friendships WHERE status = 'pending' AND requested_by <> ? AND (user_low = ? OR user_high = ?)`,
    [me, me, me, me],
  );
  const incomingFollows = await db.all<{ id: string }>("SELECT follower_id AS id FROM follows WHERE followee_id = ? AND status = 'requested'", [me]);
  return {
    friends: await summaries(db, incomingFriends.map((r) => r.id)),
    follows: await summaries(db, incomingFollows.map((r) => r.id)),
  };
}

export async function listFollowers(db: Db, userId: string) {
  const rows = await db.all<{ id: string }>("SELECT follower_id AS id FROM follows WHERE followee_id = ? AND status = 'accepted'", [userId]);
  return summaries(db, rows.map((r) => r.id));
}

export async function listFollowing(db: Db, userId: string) {
  return summaries(db, await followingIds(db, userId));
}

export async function searchUsers(db: Db, me: string, q: string) {
  const term = q.trim().toLowerCase().replace(/[%_]/g, "");
  if (term.length < 2) return [];
  const rows = await db.all<{ id: string }>(
    "SELECT id FROM users WHERE profile_public = 1 AND id <> ? AND lower(name) LIKE ? ORDER BY name LIMIT 20",
    [me, `%${term}%`],
  );
  return summaries(db, rows.map((r) => r.id));
}

/** Öffentliches Profil. Details nur für öffentliche Profile oder Follower; Fortschritt nur für Freunde. */
export async function publicUser(db: Db, viewer: string | null, targetId: string): Promise<PublicUser | null> {
  const u = await db.get<UserRow>(
    "SELECT id, name, bio, avatar_ext, avatar_version, profile_public, show_progress FROM users WHERE id = ?",
    [targetId],
  );
  if (!u) return null;
  const isSelf = viewer === targetId;
  const relation =
    viewer && !isSelf
      ? {
          following: await followState(db, viewer, targetId),
          followedBy: (await followState(db, targetId, viewer)) === "accepted",
          friend: await friendState(db, viewer, targetId),
        }
      : { following: "none" as FollowState, followedBy: false, friend: "none" as FriendState };
  const canSeeDetails = isSelf || Number(u.profile_public) === 1 || relation.following === "accepted";
  const isFriend = relation.friend === "accepted";

  const stats = canSeeDetails
    ? {
        followers: await count(db, "SELECT COUNT(*) AS n FROM follows WHERE followee_id = ? AND status = 'accepted'", [targetId]),
        following: await count(db, "SELECT COUNT(*) AS n FROM follows WHERE follower_id = ? AND status = 'accepted'", [targetId]),
        publicCollections: await count(db, "SELECT COUNT(*) AS n FROM public_collections WHERE user_id = ?", [targetId]),
        verifiedContributions: await count(db, "SELECT COUNT(*) AS n FROM contributions WHERE author_id = ? AND status = 'verified'", [targetId]),
      }
    : null;

  let progress: { known: number; learning: number } | null = null;
  if (Number(u.show_progress) === 1 && (isSelf || isFriend)) {
    const rows = await db.all<{ attr: string; n: number }>(
      "SELECT attr, COUNT(*) AS n FROM sync_rows WHERE user_id = ? AND entity = 'cards' AND deleted = 0 GROUP BY attr",
      [targetId],
    );
    const n = (s: string) => Number(rows.find((r) => r.attr === s)?.n ?? 0);
    progress = { known: n("review") + n("mastered"), learning: n("learning") + n("new") };
  }

  return {
    id: u.id,
    name: u.name,
    avatarUrl: avatarUrl(u),
    isPrivate: Number(u.profile_public) === 0,
    bio: canSeeDetails ? u.bio : null,
    stats,
    progress,
    relation,
  };
}

/** Feed: neueste öffentliche Sammlungen und verifizierte Beiträge von Freunden und Gefolgten. */
export async function feed(db: Db, me: string, limit: number): Promise<FeedItem[]> {
  const people = [...new Set([...(await friendIds(db, me)), ...(await followingIds(db, me))])];
  if (people.length === 0) return [];
  const collections = await db.all<{ user_id: string; user_name: string; at: number; title: string; kind: string }>(
    `SELECT p.user_id, u.name AS user_name, p.updated_at AS at, p.title, p.kind
     FROM public_collections p JOIN users u ON u.id = p.user_id
     WHERE p.user_id IN (${marks(people.length)}) ORDER BY p.updated_at DESC LIMIT ?`,
    [...people, limit],
  );
  const contributions = await db.all<{ user_id: string; user_name: string; at: number | null; kind: string; lang: string }>(
    `SELECT c.author_id AS user_id, u.name AS user_name, c.decided_at AS at, c.kind, c.lang
     FROM contributions c JOIN users u ON u.id = c.author_id
     WHERE c.status = 'verified' AND c.author_id IN (${marks(people.length)})
     ORDER BY c.decided_at DESC LIMIT ?`,
    [...people, limit],
  );
  const items: FeedItem[] = [
    ...collections.map((c) => ({
      type: "collection" as const,
      userId: c.user_id,
      userName: c.user_name,
      at: Number(c.at),
      title: c.title,
      detail: c.kind === "path" ? "Lernpfad" : "Medium-Wortschatz",
    })),
    ...contributions.map((c) => ({
      type: "contribution" as const,
      userId: c.user_id,
      userName: c.user_name,
      at: Number(c.at ?? 0),
      title: `Beitrag verifiziert (${c.kind})`,
      detail: c.lang,
    })),
  ];
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}
