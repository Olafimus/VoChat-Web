import { describe, expect, it } from "vitest";
import { diffWords, isSubstantialChange } from "../src/diff.js";

describe("diffWords", () => {
  it("marks removed and added words", () => {
    expect(diffWords("Yo comí una manzana", "Yo comí dos manzanas")).toEqual([
      { type: "same", text: "Yo comí " },
      { type: "del", text: "una" },
      { type: "add", text: "dos" },
      { type: "same", text: " " },
      { type: "del", text: "manzana" },
      { type: "add", text: "manzanas" },
    ]);
  });
  it("handles empty sides and punctuation", () => {
    expect(diffWords("", "neu")).toEqual([{ type: "add", text: "neu" }]);
    expect(diffWords("Haus", "Haus.")).toEqual([{ type: "same", text: "Haus" }, { type: "add", text: "." }]);
    expect(diffWords("Wasser; Getränk", "Wasser")).toEqual([{ type: "same", text: "Wasser" }, { type: "del", text: "; Getränk" }]);
  });
  it("reconstructs both texts", () => {
    const a = "the quick brown fox jumps over the lazy dog";
    const b = "a quick red fox jumped over the dog";
    const d = diffWords(a, b);
    expect(d.filter((p) => p.type !== "add").map((p) => p.text).join("")).toBe(a);
    expect(d.filter((p) => p.type !== "del").map((p) => p.text).join("")).toBe(b);
  });
  it("tells cosmetic from substantial changes", () => {
    expect(isSubstantialChange("Wasser", "wasser.")).toBe(false);
    expect(isSubstantialChange("Wasser", "Getränk")).toBe(true);
  });
});
