import { isLangCode, type LangCode } from "@vochat/shared";
import type { Db, Param } from "./db/index.js";
import { logAudit } from "./audit.js";
import { addSense, addTranslation } from "./importers/common.js";

/**
 * Expertenprüfung des Wörterbuchs. Alles gilt als ungeprüft, bis ein Experte der Sprache (oder
 * ein Admin) es prüft – auch importierte Standarddaten. Jede Aktion wird protokolliert.
 * Korrekturen erzeugen „Verdachtsfälle“: Einträge mit derselben (vermutlich ebenfalls falschen)
 * Bedeutung oder Übersetzung rücken in der Warteschlange nach vorn.
 */

export type ReviewStatus = "unreviewed" | "approved" | "needs_fix";
export type QueueFilter = "open" | "suspicious" | "needs_fix" | "approved";

const SUSPICION_LIMIT = 50;

async function markSuspicious(db: Db, lexemeIds: number[], reason: string, score: number, auditId: number, now: number) {
  for (const id of lexemeIds) {
    await db.run(
      `INSERT INTO suspicions (lexeme_id, reason, score, trigger_audit_id, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (lexeme_id, reason, trigger_audit_id) DO NOTHING`,
      [id, reason, score, auditId, now],
    );
  }
}

/** Andere Einträge derselben Sprache mit genau dieser sichtbaren Bedeutung. */
async function sameGloss(db: Db, lang: string, gloss: string, exceptLexeme: number): Promise<number[]> {
  const rows = await db.all<{ id: number }>(
    `SELECT DISTINCT s.lexeme_id AS id FROM senses s JOIN lexemes l ON l.id = s.lexeme_id
     WHERE l.lang = ? AND l.hidden = 0 AND s.hidden = 0 AND s.gloss = ? AND s.lexeme_id <> ? LIMIT ?`,
    [lang, gloss, exceptLexeme, SUSPICION_LIMIT],
  );
  return rows.map((r) => Number(r.id));
}

/** Andere Einträge derselben Sprache mit derselben sichtbaren Übersetzung. */
async function sameTranslation(db: Db, lang: string, targetLang: string, targetLemma: string, exceptLexeme: number): Promise<number[]> {
  const rows = await db.all<{ id: number }>(
    `SELECT DISTINCT t.lexeme_id AS id FROM translations t JOIN lexemes l ON l.id = t.lexeme_id
     WHERE l.lang = ? AND l.hidden = 0 AND t.hidden = 0 AND t.target_lang = ? AND t.target_lemma = ? AND t.lexeme_id <> ? LIMIT ?`,
    [lang, targetLang, targetLemma, exceptLexeme, SUSPICION_LIMIT],
  );
  return rows.map((r) => Number(r.id));
}

async function lexemeLang(db: Db, lexemeId: number): Promise<string | null> {
  return (await db.get<{ lang: string }>("SELECT lang FROM lexemes WHERE id = ?", [lexemeId]))?.lang ?? null;
}

/* ---------- Warteschlange ---------- */

export interface QueueEntry {
  id: number;
  lang: LangCode;
  lemma: string;
  pos: string | null;
  romanization: string | null;
  frequencyRank: number | null;
  status: ReviewStatus;
  reviewedBy: string | null;
  reviewedAt: number | null;
  suspicions: { reason: string; score: number }[];
  senses: { id: number; glossLang: string; gloss: string; source: string }[];
  translations: { id: number; targetLang: string; targetLemma: string; source: string }[];
  examples: { id: number; text: string; translation: string | null; source: string }[];
}

export async function reviewQueue(db: Db, opts: { lang: LangCode; filter: QueueFilter; limit: number; offset: number }): Promise<QueueEntry[]> {
  const where = ["l.lang = ?", "l.hidden = 0"];
  const params: Param[] = [opts.lang];
  // Nur Einträge mit Inhalt (Bedeutung, Übersetzung oder Aussprache) – reine Häufigkeitszeilen lohnen keine Prüfung.
  where.push(`(l.romanization IS NOT NULL
    OR EXISTS (SELECT 1 FROM senses s WHERE s.lexeme_id = l.id AND s.hidden = 0)
    OR EXISTS (SELECT 1 FROM translations t WHERE t.lexeme_id = l.id AND t.hidden = 0))`);
  if (opts.filter === "open") where.push("(r.status IS NULL OR r.status = 'needs_fix' OR sp.score IS NOT NULL)");
  if (opts.filter === "suspicious") where.push("sp.score IS NOT NULL");
  if (opts.filter === "needs_fix") where.push("r.status = 'needs_fix'");
  if (opts.filter === "approved") where.push("r.status = 'approved'");

  const rows = await db.all<{
    id: number;
    lang: string;
    lemma: string;
    pos: string;
    romanization: string | null;
    frequency_rank: number | null;
    status: string | null;
    reviewer: string | null;
    reviewed_at: number | null;
    score: number | null;
  }>(
    `SELECT l.id, l.lang, l.lemma, l.pos, l.romanization, l.frequency_rank,
            r.status, u.name AS reviewer, r.reviewed_at, sp.score
     FROM lexemes l
     LEFT JOIN entry_reviews r ON r.lexeme_id = l.id
     LEFT JOIN users u ON u.id = r.reviewer_id
     LEFT JOIN (SELECT lexeme_id, MAX(score) AS score FROM suspicions WHERE resolved = 0 GROUP BY lexeme_id) sp ON sp.lexeme_id = l.id
     WHERE ${where.join(" AND ")}
     ORDER BY CASE WHEN sp.score IS NULL THEN 1 ELSE 0 END, sp.score DESC, CASE WHEN r.status = 'needs_fix' THEN 0 ELSE 1 END,
              CASE WHEN l.frequency_rank IS NULL THEN 1 ELSE 0 END, l.frequency_rank, l.id
     LIMIT ? OFFSET ?`,
    [...params, opts.limit, opts.offset],
  );
  if (rows.length === 0) return [];
  const ids = rows.map((r) => Number(r.id));
  const marks = ids.map(() => "?").join(",");
  const [senses, translations, examples, suspicions] = await Promise.all([
    db.all<{ id: number; lexeme_id: number; gloss_lang: string; gloss: string; source: string }>(
      `SELECT id, lexeme_id, gloss_lang, gloss, source FROM senses WHERE hidden = 0 AND lexeme_id IN (${marks}) ORDER BY lexeme_id, gloss_lang, position`,
      ids,
    ),
    db.all<{ id: number; lexeme_id: number; target_lang: string; target_lemma: string; source: string }>(
      `SELECT id, lexeme_id, target_lang, target_lemma, source FROM translations WHERE hidden = 0 AND lexeme_id IN (${marks}) ORDER BY lexeme_id, target_lang, id`,
      ids,
    ),
    db.all<{ id: number; lexeme_id: number; text: string; translation: string | null; source: string }>(
      `SELECT id, lexeme_id, text, translation, source FROM examples WHERE hidden = 0 AND lexeme_id IN (${marks}) ORDER BY lexeme_id, id`,
      ids,
    ),
    db.all<{ lexeme_id: number; reason: string; score: number }>(
      `SELECT lexeme_id, reason, MAX(score) AS score FROM suspicions WHERE resolved = 0 AND lexeme_id IN (${marks}) GROUP BY lexeme_id, reason`,
      ids,
    ),
  ]);
  const by = <T extends { lexeme_id: number }>(list: T[], id: number) => list.filter((x) => Number(x.lexeme_id) === id);
  return rows.map((r) => {
    const id = Number(r.id);
    return {
      id,
      lang: r.lang as LangCode,
      lemma: r.lemma,
      pos: r.pos || null,
      romanization: r.romanization,
      frequencyRank: r.frequency_rank === null ? null : Number(r.frequency_rank),
      status: (r.status as ReviewStatus | null) ?? "unreviewed",
      reviewedBy: r.reviewer,
      reviewedAt: r.reviewed_at === null ? null : Number(r.reviewed_at),
      suspicions: by(suspicions, id).map((s) => ({ reason: s.reason, score: Number(s.score) })),
      senses: by(senses, id).map((s) => ({ id: Number(s.id), glossLang: s.gloss_lang, gloss: s.gloss, source: s.source })),
      translations: by(translations, id).map((t) => ({ id: Number(t.id), targetLang: t.target_lang, targetLemma: t.target_lemma, source: t.source })),
      examples: by(examples, id).slice(0, 5).map((e) => ({ id: Number(e.id), text: e.text, translation: e.translation, source: e.source })),
    };
  });
}

export async function reviewStats(db: Db, lang: LangCode) {
  const row = await db.get<{ approved: number; needs_fix: number; suspicious: number }>(
    `SELECT
       (SELECT COUNT(*) FROM entry_reviews r JOIN lexemes l ON l.id = r.lexeme_id WHERE l.lang = ? AND r.status = 'approved') AS approved,
       (SELECT COUNT(*) FROM entry_reviews r JOIN lexemes l ON l.id = r.lexeme_id WHERE l.lang = ? AND r.status = 'needs_fix') AS needs_fix,
       (SELECT COUNT(DISTINCT s.lexeme_id) FROM suspicions s JOIN lexemes l ON l.id = s.lexeme_id WHERE l.lang = ? AND s.resolved = 0) AS suspicious`,
    [lang, lang, lang],
  );
  return { approved: Number(row?.approved ?? 0), needsFix: Number(row?.needs_fix ?? 0), suspicious: Number(row?.suspicious ?? 0) };
}

/* ---------- Aktionen ---------- */

export type ExpertAction =
  | { action: "approve"; note?: string }
  | { action: "flag"; note: string }
  | { action: "hideSense"; senseId: number; reason?: string }
  | { action: "editSense"; senseId: number; gloss: string }
  | { action: "addSense"; glossLang: string; gloss: string }
  | { action: "addTranslation"; targetLang: string; targetLemma: string }
  | { action: "hideTranslation"; translationId: number; reason?: string }
  | { action: "setPronunciation"; romanization: string | null };

export type ActionResult = { ok: true; suspicious: number } | { ok: false; status: number; error: string };

/**
 * Führt eine Expertenaktion an einem Lexem aus (in einer Transaktion), protokolliert sie und
 * markiert verwandte Einträge als verdächtig. Rückgabe: Anzahl neu markierter Einträge.
 */
export function expertAction(db: Db, actorId: string, lexemeId: number, a: ExpertAction, now: number): Promise<ActionResult> {
  return db.tx(async (t): Promise<ActionResult> => {
    const lang = await lexemeLang(t, lexemeId);
    if (!lang) return { ok: false, status: 404, error: "not found" };
    const audit = (action: string, details: Record<string, unknown>, itemType = "lexeme", itemId: string | number = lexemeId) =>
      logAudit(t, { actorId, action, lang, lexemeId, itemType, itemId, details }, now);
    let suspicious = 0;

    switch (a.action) {
      case "approve":
      case "flag": {
        const status = a.action === "approve" ? "approved" : "needs_fix";
        await t.run(
          `INSERT INTO entry_reviews (lexeme_id, status, reviewer_id, reviewed_at, note) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT (lexeme_id) DO UPDATE SET status = excluded.status, reviewer_id = excluded.reviewer_id,
             reviewed_at = excluded.reviewed_at, note = excluded.note`,
          [lexemeId, status, actorId, now, a.note ?? null],
        );
        // Geprüft: offene Verdachtsfälle zu diesem Eintrag sind erledigt.
        if (status === "approved") await t.run("UPDATE suspicions SET resolved = 1 WHERE lexeme_id = ? AND resolved = 0", [lexemeId]);
        await audit(`review.${a.action}`, { note: a.note ?? null });
        break;
      }
      case "hideSense":
      case "editSense": {
        const sense = await t.get<{ gloss: string; gloss_lang: string }>(
          "SELECT gloss, gloss_lang FROM senses WHERE id = ? AND lexeme_id = ? AND hidden = 0",
          [a.senseId, lexemeId],
        );
        if (!sense) return { ok: false, status: 404, error: "sense not found" };
        await t.run("UPDATE senses SET hidden = 1 WHERE id = ?", [a.senseId]);
        let auditId: number;
        if (a.action === "editSense") {
          await addSense(t, lexemeId, sense.gloss_lang, a.gloss, `expert:${actorId}`);
          auditId = await audit("sense.edit", { from: sense.gloss, to: a.gloss, glossLang: sense.gloss_lang }, "sense", a.senseId);
        } else {
          auditId = await audit("sense.hide", { gloss: sense.gloss, reason: a.reason ?? null }, "sense", a.senseId);
        }
        const related = await sameGloss(t, lang, sense.gloss, lexemeId);
        await markSuspicious(t, related, `Gleiche Bedeutung „${sense.gloss}“ wurde bei einem anderen Eintrag korrigiert`, 3, auditId, now);
        suspicious = related.length;
        break;
      }
      case "addSense": {
        if (!isLangCode(a.glossLang) || !a.gloss.trim()) return { ok: false, status: 400, error: "invalid input" };
        await addSense(t, lexemeId, a.glossLang, a.gloss, `expert:${actorId}`);
        await audit("sense.add", { gloss: a.gloss.trim(), glossLang: a.glossLang });
        break;
      }
      case "addTranslation": {
        if (!isLangCode(a.targetLang) || a.targetLang === lang || !a.targetLemma.trim()) return { ok: false, status: 400, error: "invalid input" };
        await addTranslation(t, lexemeId, a.targetLang, a.targetLemma, `expert:${actorId}`);
        const auditId = await audit("translation.add", { targetLang: a.targetLang, targetLemma: a.targetLemma.trim() });
        // Andere Einträge mit derselben Übersetzung prüfen: Sie meinen dann vermutlich etwas anderes.
        const related = await sameTranslation(t, lang, a.targetLang, a.targetLemma.trim(), lexemeId);
        await markSuspicious(t, related, `Hat ebenfalls die Übersetzung „${a.targetLemma.trim()}“ (${a.targetLang}) – bitte abgrenzen`, 2, auditId, now);
        suspicious = related.length;
        break;
      }
      case "hideTranslation": {
        const tr = await t.get<{ target_lang: string; target_lemma: string }>(
          "SELECT target_lang, target_lemma FROM translations WHERE id = ? AND lexeme_id = ? AND hidden = 0",
          [a.translationId, lexemeId],
        );
        if (!tr) return { ok: false, status: 404, error: "translation not found" };
        await t.run("UPDATE translations SET hidden = 1 WHERE id = ?", [a.translationId]);
        const auditId = await audit("translation.hide", { targetLang: tr.target_lang, targetLemma: tr.target_lemma, reason: a.reason ?? null }, "translation", a.translationId);
        const related = await sameTranslation(t, lang, tr.target_lang, tr.target_lemma, lexemeId);
        await markSuspicious(t, related, `Die Übersetzung „${tr.target_lemma}“ wurde bei einem anderen Eintrag als falsch entfernt`, 3, auditId, now);
        suspicious = related.length;
        break;
      }
      case "setPronunciation": {
        const old = await t.get<{ romanization: string | null }>("SELECT romanization FROM lexemes WHERE id = ?", [lexemeId]);
        const value = a.romanization?.trim() || null;
        await t.run("UPDATE lexemes SET romanization = ? WHERE id = ?", [value, lexemeId]);
        await audit("pronunciation.set", { from: old?.romanization ?? null, to: value });
        break;
      }
    }
    return { ok: true, suspicious };
  });
}
