import { randomUUID } from "node:crypto";
import { lemmaKey, type ChallengeDetail, type ChallengeItem, type ChallengeSummary, type LangCode, type LeaderboardEntry } from "@vochat/shared";
import type { Db } from "./db/index.js";
import { friendIds } from "./social.js";
import { avatarUrl } from "./users.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKLY_SIZE = 25;
const WEEKLY_POOL = 1000;

type Row = {
  id: string;
  kind: "duel" | "group" | "weekly";
  title: string;
  lang: string;
  creator_id: string | null;
  creator_name: string | null;
  items: string;
  item_count: number;
  starts_at: number;
  ends_at: number;
  my_status: string | null;
  members: number;
};

const SELECT = `
  SELECT c.id, c.kind, c.title, c.lang, c.creator_id, u.name AS creator_name, c.items, c.item_count, c.starts_at, c.ends_at,
    (SELECT m.status FROM challenge_members m WHERE m.challenge_id = c.id AND m.user_id = ?) AS my_status,
    (SELECT COUNT(*) FROM challenge_members m WHERE m.challenge_id = c.id AND m.status = 'accepted') AS members
  FROM challenges c LEFT JOIN users u ON u.id = c.creator_id`;

const toSummary = (r: Row): ChallengeSummary => ({
  id: r.id,
  kind: r.kind,
  title: r.title,
  lang: r.lang,
  itemCount: Number(r.item_count),
  startsAt: Number(r.starts_at),
  endsAt: Number(r.ends_at),
  myStatus: (r.my_status as ChallengeSummary["myStatus"]) ?? null,
  creatorName: r.creator_name,
  members: Number(r.members),
});

export type CreateResult = { ok: true; id: string } | { ok: false; status: number; error: string };

/** Duell oder Gruppe mit Freunden. Nur bestätigte Freunde können eingeladen werden. */
export async function createChallenge(
  db: Db,
  creatorId: string,
  input: { kind: "duel" | "group"; title: string; lang: LangCode; items: ChallengeItem[]; days: number; invite: string[] },
  now: number,
): Promise<CreateResult> {
  const invite = [...new Set(input.invite)].filter((id) => id !== creatorId);
  if (input.kind === "duel" && invite.length !== 1) return { ok: false, status: 400, error: "a duel needs exactly one friend" };
  const friends = new Set(await friendIds(db, creatorId));
  if (invite.some((id) => !friends.has(id))) return { ok: false, status: 403, error: "only friends can be invited" };
  const items = dedupeItems(input.items.filter((i) => i.lang === input.lang));
  if (items.length === 0) return { ok: false, status: 400, error: "no items in this language" };

  const id = randomUUID();
  await db.tx(async (t) => {
    await t.run(
      `INSERT INTO challenges (id, kind, title, lang, creator_id, items, item_count, starts_at, ends_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.kind, input.title, input.lang, creatorId, JSON.stringify(items), items.length, now, now + input.days * DAY_MS, now],
    );
    await t.run("INSERT INTO challenge_members (challenge_id, user_id, status, invited_by, joined_at) VALUES (?, ?, 'accepted', NULL, ?)", [id, creatorId, now]);
    for (const friend of invite) {
      await t.run("INSERT INTO challenge_members (challenge_id, user_id, status, invited_by, joined_at) VALUES (?, ?, 'invited', ?, ?)", [
        id,
        friend,
        creatorId,
        now,
      ]);
    }
  });
  return { ok: true, id };
}

function dedupeItems(items: ChallengeItem[]): ChallengeItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.lexemeId ? `id:${i.lexemeId}` : `${i.lang}:${lemmaKey(i.lemma)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Montag 00:00 UTC der Woche von `now` und eine fortlaufende Wochennummer. */
export function weekWindow(now: number): { start: number; end: number; index: number; key: string } {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7; // Montag = 0
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - day * DAY_MS;
  const index = Math.floor((start - Date.UTC(1970, 0, 5)) / WEEK_MS); // 5.1.1970 war ein Montag
  return { start, end: start + WEEK_MS, index, key: new Date(start).toISOString().slice(0, 10) };
}

/**
 * Wochen-Challenge je Sprache: wird bei Bedarf angelegt. Sie zieht jede Woche andere 25 häufige
 * Wörter mit Bedeutung (rotierend durch die 1000 häufigsten). Ohne passende Daten: keine Challenge.
 */
export async function weeklyChallenge(db: Db, lang: LangCode, now: number): Promise<string | null> {
  const w = weekWindow(now);
  const weekKey = `${lang}:${w.key}`;
  const existing = await db.get<{ id: string }>("SELECT id FROM challenges WHERE week_key = ?", [weekKey]);
  if (existing) return existing.id;

  // Rotation über die vorhandenen Wörter mit Bedeutung (höchstens die 1000 häufigsten).
  const eligible = await db.get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM lexemes l WHERE l.lang = ? AND l.hidden = 0 AND l.frequency_rank IS NOT NULL
       AND EXISTS (SELECT 1 FROM senses s WHERE s.lexeme_id = l.id AND s.hidden = 0)`,
    [lang],
  );
  const pool = Math.min(WEEKLY_POOL, Number(eligible?.n ?? 0));
  if (pool === 0) return null;
  const windows = Math.max(1, Math.floor(pool / WEEKLY_SIZE));
  const offset = (w.index % windows) * WEEKLY_SIZE;
  const rows = await db.all<{ id: number; lemma: string; romanization: string | null; cefr: string | null }>(
    `SELECT l.id, l.lemma, l.romanization, l.cefr FROM lexemes l
     WHERE l.lang = ? AND l.hidden = 0 AND l.frequency_rank IS NOT NULL
       AND EXISTS (SELECT 1 FROM senses s WHERE s.lexeme_id = l.id AND s.hidden = 0)
     ORDER BY l.frequency_rank LIMIT ? OFFSET ?`,
    [lang, WEEKLY_SIZE, offset],
  );
  if (rows.length === 0) return null;
  const items: ChallengeItem[] = rows.map((r) => ({
    lemma: r.lemma,
    lang,
    lexemeId: Number(r.id),
    gloss: null,
    pronunciation: r.romanization,
    cefr: (r.cefr as ChallengeItem["cefr"]) ?? null,
  }));
  const id = randomUUID();
  await db.run(
    `INSERT INTO challenges (id, kind, title, lang, creator_id, items, item_count, starts_at, ends_at, week_key, created_at)
     VALUES (?, 'weekly', ?, ?, NULL, ?, ?, ?, ?, ?, ?) ON CONFLICT (week_key) DO NOTHING`,
    [id, `Wochen-Challenge ${w.key}`, lang, JSON.stringify(items), items.length, w.start, w.end, weekKey, now],
  );
  return (await db.get<{ id: string }>("SELECT id FROM challenges WHERE week_key = ?", [weekKey]))!.id;
}

export async function listChallenges(db: Db, userId: string): Promise<ChallengeSummary[]> {
  const rows = await db.all<Row>(
    `${SELECT} WHERE EXISTS (SELECT 1 FROM challenge_members m WHERE m.challenge_id = c.id AND m.user_id = ? AND m.status <> 'declined')
     ORDER BY c.ends_at DESC LIMIT 100`,
    [userId, userId],
  );
  return rows.map(toSummary);
}

export async function respondChallenge(db: Db, userId: string, id: string, accept: boolean, now: number): Promise<boolean> {
  const r = await db.run(
    "UPDATE challenge_members SET status = ?, joined_at = ? WHERE challenge_id = ? AND user_id = ? AND status = 'invited'",
    [accept ? "accepted" : "declined", now, id, userId],
  );
  return r.changes > 0;
}

/** Wochen-Challenges sind offen: Beitreten ohne Einladung. */
export async function joinWeekly(db: Db, userId: string, id: string, now: number): Promise<boolean> {
  const c = await db.get<{ kind: string }>("SELECT kind FROM challenges WHERE id = ?", [id]);
  if (c?.kind !== "weekly") return false;
  await db.run(
    `INSERT INTO challenge_members (challenge_id, user_id, status, invited_by, joined_at) VALUES (?, ?, 'accepted', NULL, ?)
     ON CONFLICT (challenge_id, user_id) DO UPDATE SET status = 'accepted', joined_at = excluded.joined_at`,
    [id, userId, now],
  );
  return true;
}

export async function leaveChallenge(db: Db, userId: string, id: string): Promise<void> {
  await db.run("DELETE FROM challenge_members WHERE challenge_id = ? AND user_id = ?", [id, userId]);
}

/**
 * Details mit Rangliste. Sichtbar für Teilnehmende und Eingeladene, Wochen-Challenges für alle Angemeldeten.
 * Punkte: bekanntes Challenge-Wort +10, richtige Antwort zu einem Challenge-Wort im Zeitraum +1.
 */
export async function challengeDetail(db: Db, viewer: string, id: string): Promise<ChallengeDetail | null> {
  const row = await db.get<Row>(`${SELECT} WHERE c.id = ?`, [viewer, id]);
  if (!row) return null;
  if (row.kind !== "weekly" && !row.my_status) return null;
  const items = JSON.parse(row.items) as ChallengeItem[];
  const keys = [...new Set(items.map((i) => `${i.lang}:${lemmaKey(i.lemma)}`))];
  const ids = [...new Set(items.map((i) => i.lexemeId).filter((x): x is number => !!x))];

  const members = await db.all<{ user_id: string; status: string; name: string; avatar_ext: string | null; avatar_version: number; profile_public: number }>(
    `SELECT m.user_id, m.status, u.name, u.avatar_ext, u.avatar_version, u.profile_public
     FROM challenge_members m JOIN users u ON u.id = m.user_id WHERE m.challenge_id = ?`,
    [id],
  );
  const friends = new Set(await friendIds(db, viewer));
  const keyMarks = keys.map(() => "?").join(",");
  const idMarks = ids.map(() => "?").join(",");
  const refCondition = [keys.length ? `ref_key IN (${keyMarks})` : "", ids.length ? `ref_id IN (${idMarks})` : ""].filter(Boolean).join(" OR ");

  const leaderboard: LeaderboardEntry[] = [];
  for (const m of members.filter((x) => x.status === "accepted")) {
    const cards = await db.all<{ ref_key: string | null; ref_id: number | null; attr: string | null }>(
      `SELECT ref_key, ref_id, attr FROM sync_rows WHERE user_id = ? AND entity = 'cards' AND deleted = 0 AND (${refCondition})`,
      [m.user_id, ...keys, ...ids],
    );
    let known = 0;
    let learning = 0;
    for (const item of items) {
      const k = `${item.lang}:${lemmaKey(item.lemma)}`;
      const matches = cards.filter((c) => (item.lexemeId && Number(c.ref_id) === item.lexemeId) || c.ref_key === k);
      if (matches.some((c) => c.attr === "review" || c.attr === "mastered")) known++;
      else if (matches.length) learning++;
    }
    const activity = keys.length
      ? await db.get<{ total: number; correct_count: number | null }>(
          `SELECT COUNT(*) AS total, SUM(CASE WHEN attr = 'right' THEN 1 ELSE 0 END) AS correct_count
           FROM sync_rows WHERE user_id = ? AND entity = 'reviews' AND updated_at >= ? AND updated_at < ? AND ref_key IN (${keyMarks})`,
          [m.user_id, Number(row.starts_at), Number(row.ends_at), ...keys],
        )
      : undefined;
    const correct = Number(activity?.correct_count ?? 0);
    const isMe = m.user_id === viewer;
    // Namen in offenen Wochen-Challenges nur bei öffentlichen Profilen, Freunden oder sich selbst.
    const showName = row.kind !== "weekly" || isMe || Number(m.profile_public) === 1 || friends.has(m.user_id);
    leaderboard.push({
      userId: showName ? m.user_id : null,
      name: showName ? m.name : "Anonym",
      avatarUrl: showName ? avatarUrl({ id: m.user_id, avatar_ext: m.avatar_ext, avatar_version: m.avatar_version }) : null,
      isMe,
      known,
      learning,
      reviews: Number(activity?.total ?? 0),
      correct,
      points: known * 10 + correct,
    });
  }
  leaderboard.sort((a, b) => b.points - a.points || b.known - a.known);
  return {
    ...toSummary(row),
    items,
    leaderboard: leaderboard.slice(0, 50),
    invited: members.filter((m) => m.status === "invited").map((m) => ({ id: m.user_id, name: m.name })),
  };
}
