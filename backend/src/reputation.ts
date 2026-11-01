import type { Db } from "./db/index.js";

export interface Reputation {
  score: number;
  verifiedContributions: number;
  rejectedContributions: number;
  agreeingVotes: number;
  disagreeingVotes: number;
  commentScore: number;
  expertActions: number;
}

/**
 * Punkte einer Person, transparent aus ihren Beiträgen berechnet:
 * verifizierter Beitrag +10, abgelehnter −2, Stimme im Sinne der späteren Entscheidung +2,
 * dagegen −1, Bewertungen ihrer Kommentare ±1, Expertenaktion +1.
 */
export async function reputation(db: Db, userId: string): Promise<Reputation> {
  const row = await db.get<{ verified: number; rejected: number; agree: number; disagree: number; comment_score: number | null; expert: number }>(
    `SELECT
       (SELECT COUNT(*) FROM contributions WHERE author_id = ? AND status = 'verified') AS verified,
       (SELECT COUNT(*) FROM contributions WHERE author_id = ? AND status = 'rejected') AS rejected,
       (SELECT COUNT(*) FROM votes v JOIN contributions c ON c.id = v.contribution_id
          WHERE v.user_id = ? AND ((v.vote = 'verify' AND c.status = 'verified') OR (v.vote = 'reject' AND c.status = 'rejected'))) AS agree,
       (SELECT COUNT(*) FROM votes v JOIN contributions c ON c.id = v.contribution_id
          WHERE v.user_id = ? AND ((v.vote = 'verify' AND c.status = 'rejected') OR (v.vote = 'reject' AND c.status = 'verified'))) AS disagree,
       (SELECT SUM(cv.value) FROM comment_votes cv JOIN comments cm ON cm.id = cv.comment_id WHERE cm.author_id = ? AND cm.deleted = 0) AS comment_score,
       (SELECT COUNT(*) FROM audit_log WHERE actor_id = ? AND (action LIKE 'review.%' OR action LIKE 'sense.%'
          OR action LIKE 'translation.%' OR action LIKE 'pronunciation.%')) AS expert`,
    [userId, userId, userId, userId, userId, userId],
  );
  const r = {
    verifiedContributions: Number(row?.verified ?? 0),
    rejectedContributions: Number(row?.rejected ?? 0),
    agreeingVotes: Number(row?.agree ?? 0),
    disagreeingVotes: Number(row?.disagree ?? 0),
    commentScore: Number(row?.comment_score ?? 0),
    expertActions: Number(row?.expert ?? 0),
  };
  const score =
    r.verifiedContributions * 10 - r.rejectedContributions * 2 + r.agreeingVotes * 2 - r.disagreeingVotes + r.commentScore + r.expertActions;
  return { score, ...r };
}
