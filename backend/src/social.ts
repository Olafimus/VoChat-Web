import type { FeedItem, FollowState, FriendState, PublicUser } from "@vochat/shared";
import type { Db } from "./db.js";
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

const pair = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

export function followState(db: Db, follower: string, followee: string): FollowState {
  const row = db.prepare("SELECT status FROM follows WHERE follower_id = ? AND followee_id = ?").get(follower, followee) as
    | { status: string }
    | undefined;
  return row ? (row.status as FollowState) : "none";
}

export function friendState(db: Db, me: string, other: string): FriendState {
  const [low, high] = pair(me, other);
  const row = db.prepare("SELECT status, requested_by FROM friendships WHERE user_low = ? AND user_high = ?").get(low, high) as
    | { status: string; requested_by: string }
    | undefined;
  if (!row) return "none";
  if (row.status === "accepted") return "accepted";
  return row.requested_by === me ? "outgoing" : "incoming";
}

/** Folgen: öffentliche Profile sofort, private nur mit Zustimmung. */
export function follow(db: Db, me: string, target: string, now: number): { ok: true; state: FollowState } | { ok: false; status: number; error: string } {
  if (me === target) return { ok: false, status: 400, error: "cannot follow yourself" };
  const user = db.prepare("SELECT profile_public FROM users WHERE id = ?").get(target) as { profile_public: number } | undefined;
  if (!user) return { ok: false, status: 404, error: "not found" };
  const existing = followState(db, me, target);
  if (existing !== "none") return { ok: true, state: existing };
  const status: FollowState = user.profile_public === 1 ? "accepted" : "requested";
  db.prepare("INSERT INTO follows (follower_id, followee_id, status, created_at) VALUES (?, ?, ?, ?)").run(me, target, status, now);
  return { ok: true, state: status };
}

export function unfollow(db: Db, me: string, target: string): void {
  db.prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?").run(me, target);
}

export function respondFollowRequest(db: Db, me: string, follower: string, accept: boolean): boolean {
  const row = db.prepare("SELECT status FROM follows WHERE follower_id = ? AND followee_id = ?").get(follower, me) as
    | { status: string }
    | undefined;
  if (!row || row.status !== "requested") return false;
  if (accept) db.prepare("UPDATE follows SET status = 'accepted' WHERE follower_id = ? AND followee_id = ?").run(follower, me);
  else db.prepare("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?").run(follower, me);
  return true;
}

/** Freundschaftsanfrage. Hat der andere schon angefragt, wird daraus eine Freundschaft. */
export function requestFriend(db: Db, me: string, other: string, now: number): { ok: true; state: FriendState } | { ok: false; status: number; error: string } {
  if (me === other) return { ok: false, status: 400, error: "cannot befriend yourself" };
  const exists = db.prepare("SELECT 1 FROM users WHERE id = ?").get(other);
  if (!exists) return { ok: false, status: 404, error: "not found" };
  const [low, high] = pair(me, other);
  const current = friendState(db, me, other);
  if (current === "accepted" || current === "outgoing") return { ok: true, state: current };
  if (current === "incoming") {
    db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_low = ? AND user_high = ?").run(low, high);
    return { ok: true, state: "accepted" };
  }
  db.prepare("INSERT INTO friendships (user_low, user_high, status, requested_by, created_at) VALUES (?, ?, 'pending', ?, ?)").run(low, high, me, now);
  return { ok: true, state: "outgoing" };
}

export function respondFriendRequest(db: Db, me: string, other: string, accept: boolean): boolean {
  const [low, high] = pair(me, other);
  if (friendState(db, me, other) !== "incoming") return false;
  if (accept) db.prepare("UPDATE friendships SET status = 'accepted' WHERE user_low = ? AND user_high = ?").run(low, high);
  else db.prepare("DELETE FROM friendships WHERE user_low = ? AND user_high = ?").run(low, high);
  return true;
}

export function removeFriend(db: Db, me: string, other: string): void {
  const [low, high] = pair(me, other);
  db.prepare("DELETE FROM friendships WHERE user_low = ? AND user_high = ?").run(low, high);
}

export function friendIds(db: Db, me: string): string[] {
  const rows = db
    .prepare(
      `SELECT CASE WHEN user_low = :me THEN user_high ELSE user_low END AS other
       FROM friendships WHERE status = 'accepted' AND (user_low = :me OR user_high = :me)`,
    )
    .all({ me }) as { other: string }[];
  return rows.map((r) => r.other);
}

export function followingIds(db: Db, me: string): string[] {
  return (db.prepare("SELECT followee_id AS id FROM follows WHERE follower_id = ? AND status = 'accepted'").all(me) as { id: string }[]).map((r) => r.id);
}

export function listFriends(db: Db, me: string) {
  return friendIds(db, me).map((id) => summary(db, id));
}

export function listRequests(db: Db, me: string) {
  const incomingFriends = db
    .prepare(
      `SELECT CASE WHEN user_low = :me THEN user_high ELSE user_low END AS id
       FROM friendships WHERE status = 'pending' AND requested_by != :me AND (user_low = :me OR user_high = :me)`,
    )
    .all({ me }) as { id: string }[];
  const incomingFollows = db.prepare("SELECT follower_id AS id FROM follows WHERE followee_id = ? AND status = 'requested'").all(me) as { id: string }[];
  return {
    friends: incomingFriends.map((r) => summary(db, r.id)),
    follows: incomingFollows.map((r) => summary(db, r.id)),
  };
}

export function listFollowers(db: Db, userId: string) {
  return (db.prepare("SELECT follower_id AS id FROM follows WHERE followee_id = ? AND status = 'accepted'").all(userId) as { id: string }[]).map((r) => summary(db, r.id));
}

export function listFollowing(db: Db, userId: string) {
  return followingIds(db, userId).map((id) => summary(db, id));
}

function summary(db: Db, id: string) {
  const u = db.prepare("SELECT id, name, avatar_ext, avatar_version, profile_public FROM users WHERE id = ?").get(id) as
    | { id: string; name: string; avatar_ext: string | null; avatar_version: number; profile_public: number }
    | undefined;
  return u ? { id: u.id, name: u.name, avatarUrl: avatarUrl(u), isPrivate: u.profile_public === 0 } : { id, name: "?", avatarUrl: null, isPrivate: false };
}

export function searchUsers(db: Db, me: string, q: string): ReturnType<typeof summary>[] {
  const term = q.trim();
  if (term.length < 2) return [];
  return (
    db
      .prepare(
        `SELECT id FROM users WHERE profile_public = 1 AND id != ? AND name LIKE ? ORDER BY name LIMIT 20`,
      )
      .all(me, `%${term}%`) as { id: string }[]
  ).map((r) => summary(db, r.id));
}

/** Öffentliches Profil. Details nur für öffentliche Profile oder Follower/Freunde. */
export function publicUser(db: Db, viewer: string | null, targetId: string): PublicUser | null {
  const u = db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as (UserRow & Record<string, unknown>) | undefined;
  if (!u) return null;
  const isSelf = viewer === targetId;
  const relation = viewer && !isSelf
    ? { following: followState(db, viewer, targetId), followedBy: followState(db, targetId, viewer) === "accepted", friend: friendState(db, viewer, targetId) }
    : { following: "none" as FollowState, followedBy: false, friend: "none" as FriendState };
  const canSeeDetails = isSelf || u.profile_public === 1 || relation.following === "accepted";
  const isFriend = relation.friend === "accepted";

  const stats = canSeeDetails
    ? {
        followers: (db.prepare("SELECT COUNT(*) AS n FROM follows WHERE followee_id = ? AND status = 'accepted'").get(targetId) as { n: number }).n,
        following: (db.prepare("SELECT COUNT(*) AS n FROM follows WHERE follower_id = ? AND status = 'accepted'").get(targetId) as { n: number }).n,
        publicCollections: (db
          .prepare("SELECT COUNT(*) AS n FROM sync_rows WHERE user_id = ? AND entity = 'collections' AND deleted = 0 AND json_extract(data, '$.visibility') = 'public'")
          .get(targetId) as { n: number }).n,
        verifiedContributions: (db.prepare("SELECT COUNT(*) AS n FROM contributions WHERE author_id = ? AND status = 'verified'").get(targetId) as { n: number }).n,
      }
    : null;

  // Lernfortschritt: nur wenn freigegeben und der Betrachter befreundet ist (oder selbst).
  let progress: { known: number; learning: number } | null = null;
  if (u.show_progress === 1 && (isSelf || isFriend)) {
    const rows = db
      .prepare(
        `SELECT json_extract(data, '$.status') AS status, COUNT(*) AS n FROM sync_rows
         WHERE user_id = ? AND entity = 'cards' AND deleted = 0 AND json_extract(data, '$.deleted') = 0 GROUP BY status`,
      )
      .all(targetId) as { status: string; n: number }[];
    const count = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
    progress = { known: count("review") + count("mastered"), learning: count("learning") + count("new") };
  }

  return {
    id: u.id,
    name: u.name,
    avatarUrl: avatarUrl(u),
    isPrivate: u.profile_public === 0,
    bio: canSeeDetails ? u.bio : null,
    stats,
    progress,
    relation,
  };
}

/** Feed: neueste öffentliche Sammlungen und verifizierte Beiträge von Freunden und Gefolgten. */
export function feed(db: Db, me: string, limit: number): FeedItem[] {
  const people = [...new Set([...friendIds(db, me), ...followingIds(db, me)])];
  if (people.length === 0) return [];
  const marks = people.map(() => "?").join(",");
  const collections = db
    .prepare(
      `SELECT s.user_id AS userId, u.name AS userName, s.updated_at AS at,
              json_extract(s.data, '$.title') AS title, json_extract(s.data, '$.kind') AS kind
       FROM sync_rows s JOIN users u ON u.id = s.user_id
       WHERE s.entity = 'collections' AND s.deleted = 0 AND json_extract(s.data, '$.visibility') = 'public'
         AND s.user_id IN (${marks})
       ORDER BY s.updated_at DESC LIMIT ?`,
    )
    .all(...people, limit) as { userId: string; userName: string; at: number; title: string; kind: string }[];
  const contributions = db
    .prepare(
      `SELECT c.author_id AS userId, u.name AS userName, c.decided_at AS at, c.kind AS kind, c.lang AS lang
       FROM contributions c JOIN users u ON u.id = c.author_id
       WHERE c.status = 'verified' AND c.author_id IN (${marks})
       ORDER BY c.decided_at DESC LIMIT ?`,
    )
    .all(...people, limit) as { userId: string; userName: string; at: number; kind: string; lang: string }[];

  const items: FeedItem[] = [
    ...collections.map((c) => ({
      type: "collection" as const,
      userId: c.userId,
      userName: c.userName,
      at: c.at,
      title: c.title,
      detail: c.kind === "path" ? "Lernpfad" : "Medium-Wortschatz",
    })),
    ...contributions.map((c) => ({
      type: "contribution" as const,
      userId: c.userId,
      userName: c.userName,
      at: c.at ?? 0,
      title: `Beitrag verifiziert (${c.kind})`,
      detail: c.lang,
    })),
  ];
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

