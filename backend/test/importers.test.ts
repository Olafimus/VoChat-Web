import { describe, expect, it } from "vitest";
import type { Db } from "../src/db/index.js";
import { addGloss, addLexeme, testDb } from "./helpers.js";
import { parseCsv } from "../src/importers/common.js";
import { importFreedict } from "../src/importers/freedict.js";
import { importFrequency } from "../src/importers/frequency.js";
import { importKaikki } from "../src/importers/kaikki.js";
import { commonsMp3, parseCommonsFile } from "../src/importers/commons.js";
import { importWordhoard } from "../src/importers/wordhoard.js";
import { extractWords, lexemeDetail } from "../src/dictionary.js";

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
      sounds: [
        { ipa: "/haʊ̯s/" },
        { audio: "LL-Q188 (deu)-Jane-Haus.wav", ogg_url: "https://upload.wikimedia.org/a.ogg", mp3_url: "https://upload.wikimedia.org/a.mp3" },
        { audio: "x.ogg", ogg_url: "http://insecure.example/x.ogg" },
      ],
    });
    expect(await importKaikki(db, { lang: "de", glossLang: "en", file: "t", text: line })).toBe(1);
    const lex = (await db.get("SELECT id, gender FROM lexemes WHERE lemma = 'Haus'")) as { id: number; gender: string };
    expect(lex.gender).toBe("n");
    const ex = (await db.get("SELECT translation FROM examples WHERE lexeme_id = ?", [lex.id])) as { translation: string };
    expect(ex.translation).toBe("The house is big.");
    const topic = (await db.get("SELECT c.name FROM lexeme_categories lc JOIN categories c ON c.id = lc.category_id WHERE lc.lexeme_id = ?", [lex.id])) as { name: string };
    expect(topic.name).toBe("architecture");
    expect(((await db.get("SELECT ipa FROM lexemes WHERE id = ?", [lex.id])) as { ipa: string }).ipa).toBe("/haʊ̯s/");
    const audio = await db.all<{ url: string; speaker: string }>("SELECT url, speaker FROM lexeme_audio WHERE lexeme_id = ?", [lex.id]);
    expect(audio).toEqual([{ url: "https://upload.wikimedia.org/a.mp3", speaker: "Jane" }]);
  });

  it("keeps inflected forms with grammar tags from wordhoard and still finds the lemma from a form", async () => {
    const db = await testDb();
    const csv = "lemma,pos,gender,frequency_rank,frequency_count,cefr_estimate,notes,forms\nsehen,VERB,,90,1,A1,,sieht:pres.3sg;sah:past.1sg;gesehen:part.perf;Seher:surface\n";
    expect(await importWordhoard(db, "de", csv, "t")).toBe(1);
    const lex = (await db.get("SELECT id FROM lexemes WHERE lemma = 'sehen'")) as { id: number };
    const detail = (await lexemeDetail(db, Number(lex.id), "de"))!;
    expect(detail.forms).toEqual([
      { form: "sieht", tags: ["present", "third-person", "singular"] },
      { form: "sah", tags: ["past", "first-person", "singular"] },
      { form: "gesehen", tags: ["perfect", "participle"] },
      { form: "Seher", tags: [] },
    ]);
    // Suche über gebeugte Formen (Wortschlüssel) funktioniert weiter
    const found = await extractWords(db, "de", "Er SAH es.", "de");
    expect(JSON.stringify(found)).toContain("sehen");
    // erneuter Import: keine Duplikate
    await importWordhoard(db, "de", csv, "t");
    expect(((await db.get("SELECT COUNT(*) AS n FROM lexeme_inflections")) as { n: number }).n).toBe(4);
  });

  it("imports kaikki forms and relations, linking targets that exist in the dictionary", async () => {
    const db = await testDb();
    const lines = [
      { word: "schnell", lang_code: "de", pos: "adj", senses: [{ glosses: ["fast"], synonyms: [{ word: "rasch" }] }], antonyms: [{ word: "langsam" }], forms: [{ form: "schneller", tags: ["comparative"] }, { form: "am schnellsten", tags: ["superlative"] }, { form: "x", tags: ["table-tags"] }], synonyms: [{ word: "Schnell" }, { word: "rasch" }] },
      { word: "langsam", lang_code: "de", pos: "adj", senses: [{ glosses: ["slow"] }] },
    ].map((l) => JSON.stringify(l)).join("\n");
    await importKaikki(db, { lang: "de", glossLang: "en", file: "t", text: lines });
    const id = Number(((await db.get("SELECT id FROM lexemes WHERE lemma = 'schnell'")) as { id: number }).id);
    const slow = Number(((await db.get("SELECT id FROM lexemes WHERE lemma = 'langsam'")) as { id: number }).id);
    const detail = (await lexemeDetail(db, id, "de"))!;
    expect(detail.forms).toEqual([
      { form: "schneller", tags: ["comparative"] },
      { form: "am schnellsten", tags: ["superlative"] },
    ]);
    // Synonym „Schnell“ hat denselben Wortschlüssel wie das Wort selbst und wird übersprungen; „rasch“ nur einmal
    expect(detail.relations).toEqual([
      { kind: "antonym", lemma: "langsam", lexemeId: slow },
      { kind: "synonym", lemma: "rasch", lexemeId: null },
    ]);
    // erneuter Import ersetzt statt zu verdoppeln
    await importKaikki(db, { lang: "de", glossLang: "en", file: "t", text: lines });
    expect(((await db.get("SELECT COUNT(*) AS n FROM lexeme_relations")) as { n: number }).n).toBe(2);
  });

  it("parses Lingua Libre file names and builds MP3 links", () => {
    expect(parseCommonsFile("File:LL-Q188 (deu)-Jane-essen.wav")).toEqual({ word: "essen", speaker: "Jane" });
    expect(parseCommonsFile("File:LL-Q9168 (fas)-Reza-آب.wav")).toEqual({ word: "آب", speaker: "Reza" });
    expect(parseCommonsFile("File:De-essen.ogg")).toBeNull();
    expect(commonsMp3("https://upload.wikimedia.org/wikipedia/commons/a/ab/LL-Q188_(deu)-Jane-essen.wav")).toBe(
      "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/ab/LL-Q188_(deu)-Jane-essen.wav/LL-Q188_(deu)-Jane-essen.wav.mp3",
    );
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
