import { describe, expect, it } from "vitest";
import { openDb } from "../src/db.js";
import { parseCsv } from "../src/importers/common.js";
import { importFreedict } from "../src/importers/freedict.js";
import { importFrequency } from "../src/importers/frequency.js";
import { importKaikki } from "../src/importers/kaikki.js";

describe("parseCsv", () => {
  it("handles quoted fields with commas and escaped quotes", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });
});

describe("importers", () => {
  it("imports FreeDict TEI entries with translations", () => {
    const db = openDb(":memory:");
    const xml = `<TEI><body><entry><form><orth>Alemania</orth></form><sense><cit type="trans"><quote>Germany</quote></cit></sense></entry></body></TEI>`;
    expect(importFreedict(db, { from: "es", to: "en", file: "t", xml })).toBe(1);
    const row = db
      .prepare("SELECT t.target_lemma FROM lexemes l JOIN translations t ON t.lexeme_id = l.id WHERE l.lemma = 'Alemania'")
      .get() as { target_lemma: string };
    expect(row.target_lemma).toBe("Germany");
  });

  it("is idempotent for re-imported FreeDict data", () => {
    const db = openDb(":memory:");
    const xml = `<TEI><entry><form><orth>casa</orth></form><sense><cit type="trans"><quote>house</quote></cit></sense></entry></TEI>`;
    importFreedict(db, { from: "es", to: "en", file: "t", xml });
    importFreedict(db, { from: "es", to: "en", file: "t", xml });
    const count = db.prepare("SELECT COUNT(*) n FROM senses").get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("imports kaikki JSONL with glosses, examples, gender and topics", () => {
    const db = openDb(":memory:");
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
    expect(importKaikki(db, { lang: "de", glossLang: "en", file: "t", text: line })).toBe(1);
    const lex = db.prepare("SELECT id, gender FROM lexemes WHERE lemma = 'Haus'").get() as { id: number; gender: string };
    expect(lex.gender).toBe("n");
    const ex = db.prepare("SELECT translation FROM examples WHERE lexeme_id = ?").get(lex.id) as { translation: string };
    expect(ex.translation).toBe("The house is big.");
    const topic = db.prepare("SELECT c.name FROM lexeme_categories lc JOIN categories c ON c.id = lc.category_id WHERE lc.lexeme_id = ?").get(lex.id) as { name: string };
    expect(topic.name).toBe("architecture");
  });

  it("attaches frequency ranks to existing lexemes regardless of case", () => {
    const db = openDb(":memory:");
    db.exec("INSERT INTO lexemes (lang, lemma, pos) VALUES ('de', 'Haus', 'noun')");
    importFrequency(db, "de", "der 100\nhaus 50\n", "t");
    const row = db.prepare("SELECT frequency_rank FROM lexemes WHERE lemma = 'Haus'").get() as { frequency_rank: number };
    expect(row.frequency_rank).toBe(2);
    const total = db.prepare("SELECT COUNT(*) n FROM lexemes").get() as { n: number };
    expect(total.n).toBe(2); // kein Duplikat "haus"
  });
});
