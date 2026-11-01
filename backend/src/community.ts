import { contributionPayloadSchema, type ContributionPayload, type ContributionStatus, type LangCode } from "@vochat/shared";
import { transaction, type Db } from "./db.js";
import { addExample, addSense, addTranslation, upsertLexeme } from "./importers/common.js";

export interface CommunityOptions {
  verifyThreshold: number;
  rejectThreshold: number;
  maxPendingPerUser: number;
}

export const DEFAULT_COMMUNITY: CommunityOptions = { verifyThreshold: 3, rejectThreshold: 3, maxPendingPerUser: 30 };

const TABLE: Record<string, string> = { lexeme: "lexemes", sense: "senses", example: "examples", translation: "translations" };

/* ---------- Rollen ---------- */

export function grantRole(db: Db, userId: string, role: "admin" | "expert", lang: string, now: number): void {
  db.prepare(
    `INSERT INTO user_roles (user_id, role, lang, granted_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (user_id, role, lang) DO NOTHING`,
  ).run(userId, role, role === "admin" ? "" : lang, now);
}

export function revokeRole(db: Db, userId: string, role: "admin" | "expert", lang: string): void {
  db.prepare("DELETE FROM user_roles WHERE user_id = ? AND role = ? AND lang = ?").run(userId, role, role === "admin" ? "" : lang);
}

export function rolesOf(db: Db, userId: string): { role: string; lang: string }[] {
  return db.prepare("SELECT role, lang FROM user_roles WHERE user_id = ? ORDER BY role, lang").all(userId) as { role: string; lang: string }[];
}

export function isAdmin(db: Db, userId: string): boolean {
  return !!db.prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin'").get(userId);
}

/** Admins und Experten der Sprache dürfen verbindlich entscheiden. */
export function canDecide(db: Db, userId: string, lang: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND (role = 'admin' OR (role = 'expert' AND lang = ?)) LIMIT 1")
    .get(userId, lang);
}

/* ---------- Beiträge ---------- */

export type SubmitResult = { ok: true; id: number } | { ok: false; status: number; error: string };

/** Sprache eines Beitrags ergibt sich aus dem Ziel (Lexem, Eintrag). */
function langFor(db: Db, payload: ContributionPayload): string | null {
  if (payload.kind === "lexeme") return payload.lang;
  if (payload.kind === "retract") {
    if (payload.target === "lexeme") return (db.prepare("SELECT lang FROM lexemes WHERE id = ?").get(payload.targetId) as { lang: string } | undefined)?.lang ?? null;
    const row = db
      .prepare(`SELECT l.lang FROM ${TABLE[payload.target]} t JOIN lexemes l ON l.id = t.lexeme_id WHERE t.id = ?`)
      .get(payload.targetId) as { lang: string } | undefined;
    return row?.lang ?? null;
  }
  return (db.prepare("SELECT lang FROM lexemes WHERE id = ?").get(payload.lexemeId) as { lang: string } | undefined)?.lang ?? null;
}

export function submitContribution(db: Db, authorId: string, raw: unknown, now: number, opts: CommunityOptions): SubmitResult {
  const parsed = contributionPayloadSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, status: 400, error: "invalid payload" };
  const payload = parsed.data;

  const pending = (db.prepare("SELECT COUNT(*) AS n FROM contributions WHERE author_id = ? AND status = 'pending'").get(authorId) as { n: number }).n;
  if (pending >= opts.maxPendingPerUser) return { ok: false, status: 429, error: "too many pending contributions" };

  const lang = langFor(db, payload);
  if (!lang) return { ok: false, status: 404, error: "target not found" };
  if (payload.kind === "translation" && payload.targetLang === lang) return { ok: false, status: 400, error: "same language" };

  const result = db
    .prepare("INSERT INTO contributions (kind, lang, payload, status, author_id, created_at) VALUES (?, ?, ?, 'pending', ?, ?)")
    .run(payload.kind, lang, JSON.stringify(payload), authorId, now);
  return { ok: true, id: Number(result.lastInsertRowid) };
}

/** Wendet einen verifizierten Beitrag auf das Wörterbuch an. Alle Zeilen tragen die Quelle `community:<id>`. */
function apply(db: Db, id: number, payload: ContributionPayload): number | null {
  const source = `community:${id}`;
  switch (payload.kind) {
    case "lexeme": {
      const lexemeId = upsertLexeme(db, payload.lang, payload.lemma, payload.pos);
      if (payload.gender) db.prepare("UPDATE lexemes SET gender = COALESCE(gender, ?) WHERE id = ?").run(payload.gender, lexemeId);
      if (payload.cefr) db.prepare("UPDATE lexemes SET cefr = COALESCE(cefr, ?) WHERE id = ?").run(payload.cefr, lexemeId);
      addSense(db, lexemeId, payload.glossLang, payload.gloss, source);
      return lexemeId;
    }
    case "pronunciation":
      // Nur ergänzen, wenn noch keine Aussprache hinterlegt ist. Eine bestehende wird nicht überschrieben.
      db.prepare("UPDATE lexemes SET romanization = COALESCE(romanization, ?) WHERE id = ?").run(payload.romanization, payload.lexemeId);
      return payload.lexemeId;
    case "sense":
      addSense(db, payload.lexemeId, payload.glossLang, payload.gloss, source);
      return payload.lexemeId;
    case "example":
      addExample(db, payload.lexemeId, payload.text, payload.translation, payload.translationLang, source);
      return payload.lexemeId;
    case "translation":
      addTranslation(db, payload.lexemeId, payload.targetLang, payload.targetLemma, source);
      return payload.lexemeId;
    case "retract":
      db.prepare(`UPDATE ${TABLE[payload.target]} SET hidden = 1 WHERE id = ?`).run(payload.targetId);
      return null;
  }
}

/** Macht eine angewandte Änderung rückgängig (Admin-Widerruf). Nichts wird gelöscht. */
function unapply(db: Db, id: number, payload: ContributionPayload, resultLexemeId: number | null): void {
  const source = `community:${id}`;
  if (payload.kind === "retract") {
    db.prepare(`UPDATE ${TABLE[payload.target]} SET hidden = 0 WHERE id = ?`).run(payload.targetId);
    return;
  }
  for (const table of ["senses", "examples", "translations"]) {
    db.prepare(`UPDATE ${table} SET hidden = 1 WHERE source = ?`).run(source);
  }
  if (payload.kind === "lexeme" && resultLexemeId) db.prepare("UPDATE lexemes SET hidden = 1 WHERE id = ?").run(resultLexemeId);
  if (payload.kind === "pronunciation") {
    db.prepare("UPDATE lexemes SET romanization = NULL WHERE id = ? AND romanization = ?").run(payload.lexemeId, payload.romanization);
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

export function loadContribution(db: Db, id: number): ContributionRow | undefined {
  return db.prepare("SELECT * FROM contributions WHERE id = ?").get(id) as ContributionRow | undefined;
}

export function tally(db: Db, id: number, userId: string | null) {
  const counts = db
    .prepare("SELECT SUM(vote = 'verify') AS verify, SUM(vote = 'reject') AS reject FROM votes WHERE contribution_id = ?")
    .get(id) as { verify: number | null; reject: number | null };
  const mine = userId
    ? ((db.prepare("SELECT vote FROM votes WHERE contribution_id = ? AND user_id = ?").get(id, userId) as { vote: string } | undefined)?.vote ?? null)
    : null;
  return { verify: counts.verify ?? 0, reject: counts.reject ?? 0, myVote: mine };
}

export type VoteResult = { ok: true; status: ContributionStatus } | { ok: false; status: number; error: string };

/**
 * Stimme abgeben. Experten der Sprache entscheiden sofort. Andere Nutzer brauchen
 * so viele übereinstimmende Stimmen wie konfiguriert. Eigene Beiträge kann man nicht bewerten.
 */
export function vote(db: Db, id: number, voterId: string, value: "verify" | "reject", now: number, opts: CommunityOptions): VoteResult {
  return transaction(db, () => {
    const c = loadContribution(db, id);
    if (!c) return { ok: false, status: 404, error: "not found" } as const;
    if (c.author_id === voterId) return { ok: false, status: 403, error: "own contribution" } as const;
    if (c.status !== "pending") return { ok: false, status: 409, error: "already decided" } as const;

    const expert = canDecide(db, voterId, c.lang);
    db.prepare(
      `INSERT INTO votes (contribution_id, user_id, vote, is_expert, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (contribution_id, user_id) DO UPDATE SET vote = excluded.vote, is_expert = excluded.is_expert, created_at = excluded.created_at`,
    ).run(id, voterId, value, expert ? 1 : 0, now);

    let decision: "verified" | "rejected" | null = null;
    if (expert) decision = value === "verify" ? "verified" : "rejected";
    else {
      const t = tally(db, id, null);
      if (t.verify >= opts.verifyThreshold) decision = "verified";
      else if (t.reject >= opts.rejectThreshold) decision = "rejected";
    }
    if (decision) finalize(db, c, decision, voterId, now, expert ? "Experte" : "Community");
    return { ok: true, status: decision ?? "pending" } as const;
  });
}

/** Admin- bzw. Expertenentscheid: verifizieren, ablehnen oder einen angewandten Beitrag widerrufen. */
export function decide(db: Db, id: number, deciderId: string, decision: "verify" | "reject" | "revoke", now: number): VoteResult {
  return transaction(db, () => {
    const c = loadContribution(db, id);
    if (!c) return { ok: false, status: 404, error: "not found" } as const;
    if (decision === "revoke") {
      if (c.status !== "verified") return { ok: false, status: 409, error: "only verified contributions can be revoked" } as const;
      unapply(db, id, JSON.parse(c.payload) as ContributionPayload, c.result_lexeme_id);
      db.prepare("UPDATE contributions SET status = 'revoked', decided_at = ?, decided_by = ?, decision_reason = 'widerrufen' WHERE id = ?").run(now, deciderId, id);
      return { ok: true, status: "revoked" } as const;
    }
    if (c.status !== "pending") return { ok: false, status: 409, error: "already decided" } as const;
    finalize(db, c, decision === "verify" ? "verified" : "rejected", deciderId, now, "Entscheidung");
    return { ok: true, status: decision === "verify" ? "verified" : "rejected" } as const;
  });
}

function finalize(db: Db, c: ContributionRow, decision: "verified" | "rejected", by: string, now: number, reason: string) {
  let resultLexemeId: number | null = null;
  if (decision === "verified") {
    resultLexemeId = apply(db, c.id, JSON.parse(c.payload) as ContributionPayload);
  }
  db.prepare(
    "UPDATE contributions SET status = ?, decided_at = ?, decided_by = ?, decision_reason = ?, result_lexeme_id = ? WHERE id = ?",
  ).run(decision, now, by, reason, resultLexemeId, c.id);
}

export interface ListFilter {
  status?: ContributionStatus;
  lang?: LangCode;
  mine?: string;
  limit: number;
}

export function listContributions(db: Db, f: ListFilter) {
  const rows = db
    .prepare(
      `SELECT c.id, c.kind, c.lang, c.payload, c.status, c.created_at, c.decided_at, c.decision_reason, u.name AS author
       FROM contributions c JOIN users u ON u.id = c.author_id
       WHERE (:status IS NULL OR c.status = :status)
         AND (:lang IS NULL OR c.lang = :lang)
         AND (:mine IS NULL OR c.author_id = :mine)
       ORDER BY c.id DESC LIMIT :limit`,
    )
    .all({ status: f.status ?? null, lang: f.lang ?? null, mine: f.mine ?? null, limit: f.limit }) as (Omit<ContributionRow, "author_id"> & { author: string; payload: string })[];
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    lang: r.lang,
    payload: JSON.parse(r.payload) as unknown,
    status: r.status,
    author: r.author,
    createdAt: r.created_at,
    decidedAt: r.decided_at,
    decisionReason: r.decision_reason,
  }));
}
