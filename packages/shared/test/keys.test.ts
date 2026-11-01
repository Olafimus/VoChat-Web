import { describe, expect, it } from "vitest";
import { lemmaKey, tokenize } from "../src/keys.js";

describe("lemmaKey", () => {
  it("ignores case and surrounding space", () => {
    expect(lemmaKey(" Haus ")).toBe("haus");
  });
  it("unifies Arabic and Persian letter variants, diacritics and ZWNJ", () => {
    expect(lemmaKey("كتاب")).toBe(lemmaKey("کتاب"));
    expect(lemmaKey("ميپريد")).toBe(lemmaKey("میپرید"));
    expect(lemmaKey("کِتاب")).toBe(lemmaKey("کتاب"));
    expect(lemmaKey("می‌خواهم")).toBe(lemmaKey("میخواهم"));
  });
  it("keeps different words apart", () => {
    expect(lemmaKey("Haus")).not.toBe(lemmaKey("Hans"));
  });
});

describe("tokenize", () => {
  it("returns unique words in order", () => {
    expect(tokenize("Der Hund sieht das Haus. Der Hund!")).toEqual(["Der", "Hund", "sieht", "das", "Haus"]);
  });
  it("handles Persian text", () => {
    expect(tokenize("آب و آب")).toEqual(["آب", "و"]);
  });
});
