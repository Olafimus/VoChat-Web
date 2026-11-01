import { transaction, type Db } from "../db.js";
import { addSense, addTranslation, clearSource, recordRun, upsertLexeme } from "./common.js";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/\s+/g, " ")
    .trim();

/**
 * FreeDict-TEI (XML). `from` ist die Lemma-Sprache, `to` die Glossen-/Zielsprache.
 * Jeder <entry> liefert ein Lemma (<orth>), Übersetzungen (<cit type="trans"><quote>)
 * und optional die Wortart (<pos>).
 */
export function importFreedict(db: Db, opts: { from: string; to: string; file: string; xml: string }): number {
  const source = `freedict:${opts.from}-${opts.to}`;
  let rows = 0;
  transaction(db, () => {
    clearSource(db, source);
    for (const [, body] of opts.xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)) {
      const orth = /<orth\b[^>]*>([\s\S]*?)<\/orth>/.exec(body)?.[1];
      if (!orth) continue;
      const lemma = decode(orth);
      if (!lemma) continue;
      const pos = decode(/<pos\b[^>]*>([\s\S]*?)<\/pos>/.exec(body)?.[1] ?? "");
      const id = upsertLexeme(db, opts.from, lemma, pos);
      for (const [, quote] of body.matchAll(/<cit\b[^>]*type="trans"[^>]*>[\s\S]*?<quote\b[^>]*>([\s\S]*?)<\/quote>/g)) {
        const gloss = decode(quote);
        addSense(db, id, opts.to, gloss, source);
        addTranslation(db, id, opts.to, gloss, source);
      }
      rows++;
    }
    recordRun(db, "freedict", opts.from, opts.file, rows);
  });
  return rows;
}
