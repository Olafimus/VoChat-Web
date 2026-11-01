import { lemmaKey, type LangCode, type LexemeSummary } from "@vochat/shared";
import { lexemesBatch, resolveWords } from "../api/client";
import type { CardRow, Collections, MediaCollectionRow } from "../local/collections";
import { prefs } from "./prefs";

const LAST_RUN = "vochat.linker.lastRun";
const MIN_INTERVAL_MS = 10 * 60 * 1000;
const CHUNK = 200;

const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

/**
 * Abgleich eigener Daten mit dem Wörterbuch – nachträglich und automatisch:
 * 1. Unverknüpfte Karten werden über ihre Schreibung (Wortschlüssel) aufgelöst und verknüpft.
 * 2. Verknüpfte Karten übernehmen neue Wörterbuchwerte (Bedeutung, Aussprache, Niveau),
 *    außer in Feldern, die der Nutzer selbst geändert hat.
 * 3. Wörter in eigenen Sammlungen werden ebenfalls verknüpft.
 * Geschrieben wird nur bei echten Änderungen, damit der Sync nicht unnötig läuft.
 */
export async function linkWithDictionary(
  collections: Collections,
  cards: CardRow[],
  own: MediaCollectionRow[],
  native: LangCode,
  opts: { force?: boolean } = {},
): Promise<{ linked: number; refreshed: number; items: number }> {
  const last = Number(prefs.get(LAST_RUN) ?? 0);
  if (!opts.force && Date.now() - last < MIN_INTERVAL_MS) return { linked: 0, refreshed: 0, items: 0 };
  prefs.set(LAST_RUN, String(Date.now()));

  let linked = 0;
  let refreshed = 0;
  let items = 0;
  const live = cards.filter((c) => !c.deleted);

  // 1. Unverknüpfte Karten und Sammlungswörter je Sprache auflösen
  const unlinkedCards = live.filter((c) => !c.lexemeId);
  const unlinkedItems = own.filter((c) => !c.deleted).flatMap((c) => c.items.filter((i) => !i.lexemeId).map((i) => ({ lang: i.lang, lemma: i.lemma })));
  const byLang = new Map<string, Set<string>>();
  for (const w of [...unlinkedCards, ...unlinkedItems]) {
    if (!byLang.has(w.lang)) byLang.set(w.lang, new Set());
    byLang.get(w.lang)!.add(w.lemma);
  }
  const resolved = new Map<string, LexemeSummary>(); // lang + key -> Eintrag
  for (const [lang, words] of byLang) {
    for (const part of chunks([...words], CHUNK)) {
      const result = await resolveWords(lang as LangCode, part, native);
      for (const [key, lexeme] of Object.entries(result)) resolved.set(`${lang}\u0001${key}`, lexeme);
    }
  }
  const match = (lang: string, lemma: string) => resolved.get(`${lang}\u0001${lemmaKey(lemma)}`);

  for (const card of unlinkedCards) {
    const hit = match(card.lang, card.lemma);
    if (!hit) continue;
    const custom = new Set(card.custom ?? []);
    collections.cards.update(card.id, (d) => {
      d.lexemeId = hit.id;
      if (!custom.has("gloss") && !d.gloss && hit.gloss) d.gloss = hit.gloss;
      if (!custom.has("pronunciation") && !d.pronunciation && hit.romanization) d.pronunciation = hit.romanization;
      if (!custom.has("cefr") && !d.cefr && hit.cefr) d.cefr = hit.cefr;
      if (hit.frequencyRank) d.rank = hit.frequencyRank;
      d.updatedAt = Date.now();
    });
    linked++;
  }

  for (const coll of own.filter((c) => !c.deleted && c.items.some((i) => !i.lexemeId))) {
    let changed = false;
    const next = coll.items.map((i) => {
      if (i.lexemeId) return i;
      const hit = match(i.lang, i.lemma);
      if (!hit) return i;
      changed = true;
      items++;
      return { ...i, lexemeId: hit.id, gloss: i.gloss ?? hit.gloss, pronunciation: i.pronunciation ?? hit.romanization, cefr: i.cefr ?? hit.cefr };
    });
    if (changed) {
      collections.collections.update(coll.id, (d) => {
        d.items = next;
        d.updatedAt = Date.now();
      });
    }
  }

  // 2. Verknüpfte Karten aktualisieren (nur Felder ohne eigene Änderung)
  const linkedCards = live.filter((c) => c.lexemeId);
  for (const part of chunks(linkedCards, CHUNK)) {
    const fresh = new Map((await lexemesBatch(part.map((c) => c.lexemeId!), native)).map((l) => [l.id, l]));
    for (const card of part) {
      const main = fresh.get(card.lexemeId!);
      if (!main) continue; // Eintrag ausgeblendet oder entfernt: eigene Daten bleiben unverändert
      const custom = new Set(card.custom ?? []);
      const patch: Partial<CardRow> = {};
      if (!custom.has("gloss") && main.gloss && main.gloss !== card.gloss) patch.gloss = main.gloss;
      if (!custom.has("pronunciation") && main.romanization && main.romanization !== card.pronunciation) patch.pronunciation = main.romanization;
      if (!custom.has("cefr") && main.cefr && main.cefr !== card.cefr) patch.cefr = main.cefr;
      if (main.frequencyRank && main.frequencyRank !== card.rank) patch.rank = main.frequencyRank;
      if (Object.keys(patch).length === 0) continue;
      collections.cards.update(card.id, (d) => {
        Object.assign(d, patch);
        d.updatedAt = Date.now();
      });
      refreshed++;
    }
  }
  return { linked, refreshed, items };
}
