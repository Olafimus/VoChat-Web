import type { Db } from "../db/index.js";
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
 * Jeder <entry> liefert ein Lemma (<orth>), Übersetzungen (<cit type="trans"><quote>) und optional die Wortart.
 */
export async function importFreedict(db: Db, opts: { from: string; to: string; file: string; xml: string }): Promise<number> {
  const source = `freedict:${opts.from}-${opts.to}`;
  let rows = 0;
  await db.tx(async (t) => {
    await clearSource(t, source);
    for (const [, body] of opts.xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)) {
      const orth = /<orth\b[^>]*>([\s\S]*?)<\/orth>/.exec(body)?.[1];
      if (!orth) continue;
      const lemma = decode(orth);
      if (!lemma) continue;
      const pos = decode(/<pos\b[^>]*>([\s\S]*?)<\/pos>/.exec(body)?.[1] ?? "");
      const id = await upsertLexeme(t, opts.from, lemma, pos);
      for (const [, quote] of body.matchAll(/<cit\b[^>]*type="trans"[^>]*>[\s\S]*?<quote\b[^>]*>([\s\S]*?)<\/quote>/g)) {
        const gloss = decode(quote);
        await addSense(t, id, opts.to, gloss, source);
        await addTranslation(t, id, opts.to, gloss, source);
      }
      rows++;
    }
    await recordRun(t, "freedict", opts.from, opts.file, rows);
  });
  return rows;
}
