import { contributionPayloadSchema, type ContributionPayload, type ContributionStatus, type LangCode } from "@vochat/shared";
import type { Db, Param } from "./db/index.js";
import { addExample, addSense, addTranslation, upsertLexeme } from "./importers/common.js";

export interface CommunityOptions {
  verifyThreshold: number;
  rejectThreshold: number;
  maxPendingPerUser: number;
}

export const DEFAULT_COMMUNITY: CommunityOptions = { verifyThreshold: 3, rejectThreshold: 3, maxPendingPerUser: 30 };

const TABLE: Record<string, string> = { lexeme: "lexemes", sense: "senses", example: "examples", translation: "translations" };

/* ---------- Rollen ---------- */

export async function grantRole(db: Db, userId: string, role: "admin" | "expert", lang: string, now: number): Promise<void> {
  await db.run(
    `INSERT INTO user_roles (user_id, role, lang, granted_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, role, lang) DO NOTHING`,
    [userId, role, role === "admin" ? "" : lang, now],
  );
}

export async function revokeRole(db: Db, userId: string, role: "admin" | "expert", lang: string): Promise<void> {
  await db.run("DELETE FROM user_roles WHERE user_id = ? AND role = ? AND lang = ?", [userId, role, role === "admin" ? "" : lang]);
}

export function rolesOf(db: Db, userId: string) {
  return db.all<{ role: string; lang: string }>("SELECT role, lang FROM user_roles WHERE user_id = ? ORDER BY role, lang", [userId]);
}

export async function isAdmin(db: Db, userId: string): Promise<boolean> {
  return !!(await db.get("SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND role = 'admin'", [userId]));
}

/** Admins und Experten der Sprache dürfen verbindlich entscheiden. */
export async function canDecide(db: Db, userId: string, lang: string): Promise<boolean> {
  return !!(await db.get(
    "SELECT 1 AS ok FROM user_roles WHERE user_id = ? AND (role = 'admin' OR (role = 'expert' AND lang = ?)) LIMIT 1",
    [userId, lang],
  ));
}

/* ---------- Beiträge ---------- */

export type SubmitResult = { ok: true; id: number } | { ok: false; status: number; error: string };

/** Sprache eines Beitrags ergibt sich aus dem Ziel (Lexem, Eintrag). */
async function langFor(db: Db, payload: ContributionPayload): Promise<string | null> {
  if (payload.kind === "lexeme") return payload.lang;
  if (payload.kind === "retract") {
    if (payload.target === "lexeme") {
      return (await db.get<{ lang: string }>("SELECT lang FROM lexemes WHERE id = ?", [payload.targetId]))?.lang ?? null;
    }
    const row = await db.get<{ lang: string }>(
      `SELECT l.lang FROM ${TABLE[payload.target]} t JOIN lexemes l ON l.id = t.lexeme_id WHERE t.id = ?`,
      [payload.targetId],
    );
    return row?.lang ?? null;
  }
  return (await db.get<{ lang: string }>("SELECT lang FROM lexemes WHERE id = ?", [payload.lexemeId]))?.lang ?? null;
}

export async function submitContribution(db: Db, authorId: string, raw: unknown, now: number, opts: CommunityOptions): Promise<SubmitResult> {
  const parsed = contributionPayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: "invalid payload" };
  const payload = parsed.data;

  const pending = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM contributions WHERE author_id = ? AND status = 'pending'", [authorId]);
  if (Number(pending?.n ?? 0) >= opts.maxPendingPerUser) return { ok: false, status: 429, error: "too many pending contributions" };

  const lang = await langFor(db, payload);
  if (!lang) return { ok: false, status: 404, error: "target not found" };
  if (payload.kind === "translation" && payload.targetLang === lang) return { ok: false, status: 400, error: "same language" };

  const row = await db.get<{ id: number }>(
    "INSERT INTO contributions (kind, lang, payload, status, author_id, created_at) VALUES (?, ?, ?, 'pending', ?, ?) RETURNING id",
    [payload.kind, lang, JSON.stringify(payload), authorId, now],
  );
  return { ok: true, id: Number(row!.id) };
}

/** Wendet einen verifizierten Beitrag auf das Wörterbuch an. Alle Zeilen tragen die Quelle `community:<id>`. */
async function apply(db: Db, id: number, payload: ContributionPayload): Promise<number | null> {
  const source = `community:${id}`;
  switch (payload.kind) {
    case "lexeme": {
      const lexemeId = await upsertLexeme(db, payload.lang, payload.lemma, payload.pos);
      if (payload.gender) await db.run("UPDATE lexemes SET gender = COALESCE(gender, ?) WHERE id = ?", [payload.gender, lexemeId]);
      if (payload.cefr) await db.run("UPDATE lexemes SET cefr = COALESCE(cefr, ?) WHERE id = ?", [payload.cefr, lexemeId]);
      if (payload.romanization) {
        await db.run("UPDATE lexemes SET romanization = COALESCE(romanization, ?) WHERE id = ?", [payload.romanization, lexemeId]);
      }
      await addSense(db, lexemeId, payload.glossLang, payload.gloss, source);
      return lexemeId;
    }
    case "pronunciation":
      // Nur ergänzen, wenn noch keine Aussprache hinterlegt ist; eine bestehende bleibt.
      await db.run("UPDATE lexemes SET romanization = COALESCE(romanization, ?) WHERE id = ?", [payload.romanization, payload.lexemeId]);
      return payload.lexemeId;
    case "sense":
      await addSense(db, payload.lexemeId, payload.glossLang, payload.gloss, source);
      return payload.lexemeId;
    case "example":
      await addExample(db, payload.lexemeId, payload.text, payload.translation, payload.translationLang, source);
      return payload.lexemeId;
    case "translation":
      await addTranslation(db, payload.lexemeId, payload.targetLang, payload.targetLemma, source);
      return payload.lexemeId;
    case "retract":
      await db.run(`UPDATE ${TABLE[payload.target]} SET hidden = 1 WHERE id = ?`, [payload.targetId]);
      return null;
  }
}

/** Macht eine angewandte Änderung rückgängig (Admin-Widerruf). Nichts wird gelöscht. */
async function unapply(db: Db, id: number, payload: ContributionPayload, resultLexemeId: number | null): Promise<void> {
  const source = `community:${id}`;
  if (payload.kind === "retract") {
    await db.run(`UPDATE ${TABLE[payload.target]} SET hidden = 0 WHERE id = ?`, [payload.targetId]);
    return;
  }
  for (const table of ["senses", "examples", "translations"]) {
    await db.run(`UPDATE ${table} SET hidden = 1 WHERE source = ?`, [source]);
  }
  if (payload.kind === "lexeme" && resultLexemeId) await db.run("UPDATE lexemes SET hidden = 1 WHERE id = ?", [resultLexemeId]);
  if (payload.kind === "pronunciation") {
    await db.run("UPDATE lexemes SET romanization = NULL WHERE id = ? AND romanization = ?", [payload.lexemeId, payload.romanization]);
  }
}

interface ContributionRow {
  id: number;
  kind: string;
  lang: string;
  payload: string;
  status: ContributionStatus;
  author_id: string;
  created_at: number;
  decided_at: number | null;
  decision_reason: string | null;
  result_lexeme_id: number | null;
}

export function loadContribution(db: Db, id: number) {
  return db.get<ContributionRow>("SELECT * FROM contributions WHERE id = ?", [id]);
}

export async function tally(db: Db, id: number, userId: string | null) {
  const counts = await db.get<{ verify: number | null; reject: number | null }>(
    `SELECT SUM(CASE WHEN vote = 'verify' THEN 1 ELSE 0 END) AS verify,
            SUM(CASE WHEN vote = 'reject' THEN 1 ELSE 0 END) AS reject
     FROM votes WHERE contribution_id = ?`,
    [id],
  );
  const mine = userId
    ? ((await db.get<{ vote: string }>("SELECT vote FROM votes WHERE contribution_id = ? AND user_id = ?", [id, userId]))?.vote ?? null)
    : null;
  return { verify: Number(counts?.verify ?? 0), reject: Number(counts?.reject ?? 0), myVote: mine };
}

export type VoteResult = { ok: true; status: ContributionStatus } | { ok: false; status: number; error: string };

/**
 * Stimme abgeben. Experten der Sprache entscheiden sofort. Andere Nutzer brauchen so viele
 * übereinstimmende Stimmen wie konfiguriert. Eigene Beiträge kann man nicht bewerten.
 */
export function vote(db: Db, id: number, voterId: string, value: "verify" | "reject", now: number, opts: CommunityOptions): Promise<VoteResult> {
  return db.tx(async (t): Promise<VoteResult> => {
    const c = await loadContribution(t, id);
    if (!c) return { ok: false, status: 404, error: "not found" };
    if (c.author_id === voterId) return { ok: false, status: 403, error: "own contribution" };
    if (c.status !== "pending") return { ok: false, status: 409, error: "already decided" };

    const expert = await canDecide(t, voterId, c.lang);
    await t.run(
      `INSERT INTO votes (contribution_id, user_id, vote, is_expert, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (contribution_id, user_id) DO UPDATE SET vote = excluded.vote, is_expert = excluded.is_expert, created_at = excluded.created_at`,
      [id, voterId, value, expert ? 1 : 0, now],
    );

    let decision: "verified" | "rejected" | null = null;
    if (expert) decision = value === "verify" ? "verified" : "rejected";
    else {
      const counts = await tally(t, id, null);
      if (counts.verify >= opts.verifyThreshold) decision = "verified";
      else if (counts.reject >= opts.rejectThreshold) decision = "rejected";
    }
    if (decision) await finalize(t, c, decision, voterId, now, expert ? "Experte" : "Community");
    return { ok: true, status: decision ?? "pending" };
  });
}

/** Admin- bzw. Expertenentscheid: verifizieren, ablehnen oder einen angewandten Beitrag widerrufen. */
export function decide(db: Db, id: number, deciderId: string, decision: "verify" | "reject" | "revoke", now: number): Promise<VoteResult> {
  return db.tx(async (t): Promise<VoteResult> => {
    const c = await loadContribution(t, id);
    if (!c) return { ok: false, status: 404, error: "not found" };
    if (decision === "revoke") {
      if (c.status !== "verified") return { ok: false, status: 409, error: "only verified contributions can be revoked" };
      await unapply(t, id, JSON.parse(c.payload) as ContributionPayload, c.result_lexeme_id === null ? null : Number(c.result_lexeme_id));
      await t.run("UPDATE contributions SET status = 'revoked', decided_at = ?, decided_by = ?, decision_reason = 'widerrufen' WHERE id = ?", [
        now,
        deciderId,
        id,
      ]);
      return { ok: true, status: "revoked" };
    }
    if (c.status !== "pending") return { ok: false, status: 409, error: "already decided" };
    const status = decision === "verify" ? "verified" : "rejected";
    await finalize(t, c, status, deciderId, now, "Entscheidung");
    return { ok: true, status };
  });
}

async function finalize(db: Db, c: ContributionRow, decision: "verified" | "rejected", by: string, now: number, reason: string) {
  const resultLexemeId = decision === "verified" ? await apply(db, Number(c.id), JSON.parse(c.payload) as ContributionPayload) : null;
  await db.run("UPDATE contributions SET status = ?, decided_at = ?, decided_by = ?, decision_reason = ?, result_lexeme_id = ? WHERE id = ?", [
    decision,
    now,
    by,
    reason,
    resultLexemeId,
    c.id,
  ]);
}

export interface ListFilter {
  status?: ContributionStatus;
  lang?: LangCode;
  mine?: string;
  limit: number;
}

export async function listContributions(db: Db, f: ListFilter) {
  const where: string[] = [];
  const params: Param[] = [];
  if (f.status) {
    where.push("c.status = ?");
    params.push(f.status);
  }
  if (f.lang) {
    where.push("c.lang = ?");
    params.push(f.lang);
  }
  if (f.mine) {
    where.push("c.author_id = ?");
    params.push(f.mine);
  }
  const rows = await db.all<ContributionRow & { author: string }>(
    `SELECT c.id, c.kind, c.lang, c.payload, c.status, c.created_at, c.decided_at, c.decision_reason, u.name AS author
     FROM contributions c JOIN users u ON u.id = c.author_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY c.id DESC LIMIT ?`,
    [...params, f.limit],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    lang: r.lang,
    payload: JSON.parse(r.payload) as unknown,
    status: r.status,
    author: r.author,
    createdAt: Number(r.created_at),
    decidedAt: r.decided_at === null ? null : Number(r.decided_at),
    decisionReason: r.decision_reason,
  }));
}
