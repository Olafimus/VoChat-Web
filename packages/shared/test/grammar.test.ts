import { describe, expect, it } from "vitest";
import { groupForms, normalizeFormTags, parseShortTags, parseTags, serializeTags } from "../src/grammar.js";

describe("form tags", () => {
  it("parses wordhoard short tags", () => {
    expect(parseShortTags("pres.3sg")).toEqual(["present", "third-person", "singular"]);
    expect(parseShortTags("subj.impf.1pl")).toEqual(["imperfect", "subjunctive", "first-person", "plural"]);
    expect(parseShortTags("part.perf")).toEqual(["perfect", "participle"]);
    expect(parseShortTags("nom.pl")).toEqual(["plural", "nominative"]);
    expect(parseShortTags("surface")).toEqual([]);
    expect(parseShortTags("")).toEqual([]);
  });

  it("normalizes kaikki tags and drops noise", () => {
    expect(normalizeFormTags(["third-person", "singular", "preterite", "strong", "table-tags"])).toEqual(["past", "third-person", "singular"]);
    expect(normalizeFormTags(["past-participle"])).toEqual(["past", "participle"]);
    expect(parseTags(serializeTags(["comparative"]))).toEqual(["comparative"]);
  });
});

describe("groupForms", () => {
  const forms = [
    ["sieht", "pres.3sg"],
    ["sehe", "pres.1sg"],
    ["siehst", "pres.2sg"],
    ["sah", "past.1sg"],
    ["gesehen", "part.perf"],
    ["sieh", "imp.sg"],
    ["seht", "imp.pl"],
    ["sähe", "subj.impf.1sg"],
    ["sehend", "part.pres"],
    ["Sehens", "gen.sg"],
    ["Seher", "surface"],
  ].map(([form, t]) => ({ form: form!, tags: parseShortTags(t!) }));

  it("builds conjugation tables with pronouns and orders groups", () => {
    const groups = groupForms(forms, "de");
    expect(groups.map((g) => g.title)).toEqual(["Präsens", "Präteritum", "Konjunktiv Imperfekt", "Imperativ", "Infinite Formen", "Deklination", "Weitere Formen"]);
    expect(groups[0]!.rows).toEqual([
      { label: "ich", forms: ["sehe"] },
      { label: "du", forms: ["siehst"] },
      { label: "er/sie/es", forms: ["sieht"] },
    ]);
    expect(groups.find((g) => g.title === "Imperativ")!.rows.map((r) => r.label)).toEqual(["du", "ihr"]);
    expect(groups.find((g) => g.title === "Infinite Formen")!.rows).toEqual([
      { label: "Partizip Perfekt", forms: ["gesehen"] },
      { label: "Partizip Präsens", forms: ["sehend"] },
    ]);
    expect(groups.find((g) => g.title === "Deklination")!.rows).toEqual([{ label: "Genitiv Singular", forms: ["Sehens"] }]);
  });

  it("falls back to generic person labels and groups comparison", () => {
    const groups = groupForms(
      [
        { form: "taberu", tags: ["present", "first-person", "singular"] },
        { form: "größer", tags: ["comparative"] },
        { form: "am größten", tags: ["superlative"] },
        { form: "Häuser", tags: ["plural"] },
      ],
      "ja",
    );
    expect(groups.find((g) => g.title === "Präsens")!.rows[0]!.label).toBe("1. Sg.");
    expect(groups.find((g) => g.title === "Steigerung")!.rows.map((r) => r.forms[0])).toEqual(["größer", "am größten"]);
    expect(groups.find((g) => g.title === "Formen")!.rows).toEqual([{ label: "Plural", forms: ["Häuser"] }]);
  });
});
