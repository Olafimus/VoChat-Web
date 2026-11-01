import type { Db } from "./db/index.js";

/**
 * Neuigkeiten für die Startseite – aus vorhandenen Tabellen zusammengestellt, ohne eigene Speicherung.
 * „Gelesen“ merkt sich der Client (Zeitstempel), daher ist jede Meldung nur ein Verweis.
 */
export type NotificationKind =
  | "friend_request"
  | "follow_request"
  | "new_follower"
  | "challenge_invite"
  | "comment_reply"
  | "comment_on_contribution"
  | "contribution_decided";

export interface Notification {
  kind: NotificationKind;
  at: number;
  actor: { id: string; name: string } | null;
  /** Ziel zum Öffnen, z. B. "challenge:<id>", "user:<id>", "contribution:<id>". */
  target: string | null;
  text: string;
}

type Row = { at: number; actor_id: string | null; actor_name: string | null; target: string | null; extra: string | null };

export async function notifications(db: Db, me: string, now: number, limit = 30): Promise<Notification[]> {
  const q = (sql: string, params: unknown[]) => db.all<Row>(sql, params as never[]);
  const [friendReq, followReq, followers, invites, replies, onContrib, decided] = await Promise.all([
    q(
      `SELECT f.created_at AS at, u.id AS actor_id, u.name AS actor_name, NULL AS target, NULL AS extra
       FROM friendships f JOIN users u ON u.id = f.requested_by
       WHERE f.status = 'pending' AND f.requested_by <> ? AND (f.user_low = ? OR f.user_high = ?)
       ORDER BY f.created_at DESC LIMIT ?`,
      [me, me, me, limit],
    ),
    q(
      `SELECT f.created_at AS at, u.id AS actor_id, u.name AS actor_name, NULL AS target, NULL AS extra
       FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.followee_id = ? AND f.status = 'requested' ORDER BY f.created_at DESC LIMIT ?`,
      [me, limit],
    ),
    q(
      `SELECT f.created_at AS at, u.id AS actor_id, u.name AS actor_name, NULL AS target, NULL AS extra
       FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.followee_id = ? AND f.status = 'accepted' ORDER BY f.created_at DESC LIMIT ?`,
      [me, Math.min(limit, 10)],
    ),
    q(
      `SELECT m.joined_at AS at, u.id AS actor_id, u.name AS actor_name, c.id AS target, c.title AS extra
       FROM challenge_members m JOIN challenges c ON c.id = m.challenge_id LEFT JOIN users u ON u.id = m.invited_by
       WHERE m.user_id = ? AND m.status = 'invited' AND c.ends_at > ? ORDER BY m.joined_at DESC LIMIT ?`,
      [me, now, limit],
    ),
    q(
      `SELECT c.created_at AS at, u.id AS actor_id, u.name AS actor_name, c.target_type || ':' || c.target_id AS target, c.body AS extra
       FROM comments c JOIN comments p ON p.id = c.parent_id JOIN users u ON u.id = c.author_id
       WHERE p.author_id = ? AND c.author_id <> ? AND c.deleted = 0 ORDER BY c.created_at DESC LIMIT ?`,
      [me, me, limit],
    ),
    q(
      `SELECT c.created_at AS at, u.id AS actor_id, u.name AS actor_name, 'contribution:' || c.target_id AS target, c.body AS extra
       FROM comments c JOIN contributions k ON c.target_type = 'contribution' AND c.target_id = CAST(k.id AS TEXT)
       JOIN users u ON u.id = c.author_id
       WHERE k.author_id = ? AND c.author_id <> ? AND c.parent_id IS NULL AND c.deleted = 0 ORDER BY c.created_at DESC LIMIT ?`,
      [me, me, limit],
    ),
    q(
      `SELECT k.decided_at AS at, NULL AS actor_id, NULL AS actor_name, 'contribution:' || CAST(k.id AS TEXT) AS target,
              k.status || '|' || k.payload AS extra
       FROM contributions k WHERE k.author_id = ? AND k.decided_at IS NOT NULL AND k.status IN ('verified', 'rejected')
       ORDER BY k.decided_at DESC LIMIT ?`,
      [me, limit],
    ),
  ]);

  const actor = (r: Row) => (r.actor_id ? { id: r.actor_id, name: r.actor_name ?? "?" } : null);
  const snippet = (s: string | null) => {
    const t = (s ?? "").replace(/\s+/g, " ").trim();
    return t.length > 80 ? `${t.slice(0, 77)}…` : t;
  };
  const out: Notification[] = [
    ...friendReq.map((r) => ({ kind: "friend_request" as const, at: Number(r.at), actor: actor(r), target: `user:${r.actor_id}`, text: "möchte mit dir befreundet sein" })),
    ...followReq.map((r) => ({ kind: "follow_request" as const, at: Number(r.at), actor: actor(r), target: `user:${r.actor_id}`, text: "möchte dir folgen" })),
    ...followers.map((r) => ({ kind: "new_follower" as const, at: Number(r.at), actor: actor(r), target: `user:${r.actor_id}`, text: "folgt dir jetzt" })),
    ...invites.map((r) => ({ kind: "challenge_invite" as const, at: Number(r.at), actor: actor(r), target: `challenge:${r.target}`, text: `lädt dich zur Challenge „${snippet(r.extra)}“ ein` })),
    ...replies.map((r) => ({ kind: "comment_reply" as const, at: Number(r.at), actor: actor(r), target: r.target, text: `hat geantwortet: „${snippet(r.extra)}“` })),
    ...onContrib.map((r) => ({ kind: "comment_on_contribution" as const, at: Number(r.at), actor: actor(r), target: r.target, text: `kommentiert deinen Vorschlag: „${snippet(r.extra)}“` })),
    ...decided.map((r) => {
      const [status, payload] = (r.extra ?? "").split(/\|(.*)/s);
      let word = "";
      try {
        const p = JSON.parse(payload ?? "{}") as { lemma?: string };
        word = p.lemma ? ` „${p.lemma}“` : "";
      } catch {
        /* altes Format */
      }
      return {
        kind: "contribution_decided" as const,
        at: Number(r.at),
        actor: null,
        target: r.target,
        text: status === "verified" ? `Dein Vorschlag${word} wurde verifiziert ✓` : `Dein Vorschlag${word} wurde abgelehnt`,
      };
    }),
  ];
  return out.sort((a, b) => b.at - a.at).slice(0, limit);
}
