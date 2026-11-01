import { describe, expect, it } from "vitest";
import type { Db } from "../src/db/index.js";
import { addGloss, addLexeme, testDb } from "./helpers.js";
import { parseCsv } from "../src/importers/common.js";
import { importFreedict } from "../src/importers/freedict.js";
import { importFrequency } from "../src/importers/frequency.js";
import { importKaikki } from "../src/importers/kaikki.js";

describe("parseCsv", () => {
  it("handles quoted fields with commas and escaped quotes", async () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });
});

describe("importers", () => {
  it("imports FreeDict TEI entries with translations", async () => {
    const db = await testDb();
    const xml = `<TEI><body><entry><form><orth>Alemania</orth></form><sense><cit type="trans"><quote>Germany</quote></cit></sense></entry></body></TEI>`;
    expect(await importFreedict(db, { from: "es", to: "en", file: "t", xml })).toBe(1);
    const row = (await db.get("SELECT t.target_lemma FROM lexemes l JOIN translations t ON t.lexeme_id = l.id WHERE l.lemma = 'Alemania'")) as {
      target_lemma: string;
    };
    expect(row.target_lemma).toBe("Germany");
  });

  it("is idempotent for re-imported FreeDict data", async () => {
    const db = await testDb();
    const xml = `<TEI><entry><form><orth>casa</orth></form><sense><cit type="trans"><quote>house</quote></cit></sense></entry></TEI>`;
    await importFreedict(db, { from: "es", to: "en", file: "t", xml });
    await importFreedict(db, { from: "es", to: "en", file: "t", xml });
    const count = (await db.get("SELECT COUNT(*) AS n FROM senses")) as { n: number };
    expect(count.n).toBe(1);
  });

  it("imports kaikki JSONL with glosses, examples, gender and topics", async () => {
    const db = await testDb();
    const line = JSON.stringify({
      word: "Haus",
      lang_code: "de",
      pos: "noun",
      senses: [
        {
          glosses: ["house"],
          tags: ["neuter"],
          topics: ["architecture"],
          examples: [{ text: "Das Haus ist groß.", english: "The house is big." }],
        },
      ],
      translations: [{ lang_code: "es", word: "casa" }],
    });
    expect(await importKaikki(db, { lang: "de", glossLang: "en", file: "t", text: line })).toBe(1);
    const lex = (await db.get("SELECT id, gender FROM lexemes WHERE lemma = 'Haus'")) as { id: number; gender: string };
    expect(lex.gender).toBe("n");
    const ex = (await db.get("SELECT translation FROM examples WHERE lexeme_id = ?", [lex.id])) as { translation: string };
    expect(ex.translation).toBe("The house is big.");
    const topic = (await db.get("SELECT c.name FROM lexeme_categories lc JOIN categories c ON c.id = lc.category_id WHERE lc.lexeme_id = ?", [lex.id])) as { name: string };
    expect(topic.name).toBe("architecture");
  });

  it("attaches frequency ranks to existing lexemes regardless of case", async () => {
    const db = await testDb();
    await addLexeme(db, { lang: "de", lemma: "Haus", pos: "noun" });
    await importFrequency(db, "de", "der 100\nhaus 50\n", "t");
    const row = (await db.get("SELECT frequency_rank FROM lexemes WHERE lemma = 'Haus'")) as { frequency_rank: number };
    expect(row.frequency_rank).toBe(2);
    const total = (await db.get("SELECT COUNT(*) AS n FROM lexemes")) as { n: number };
    expect(total.n).toBe(2); // kein Duplikat "haus"
  });
});
