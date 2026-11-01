import { describe, expect, it } from "vitest";
import { judgeAnswer, normalizeAnswer, editDistance, splitAnswers } from "../src/typing.js";

describe("judgeAnswer", () => {
  it("accepts exact answers ignoring case, punctuation and spacing", () => {
    expect(judgeAnswer(["Haus"], " haus. ").verdict).toBe("correct");
  });

  it("tolerates one typo in a 10-letter word", () => {
    // "Schmetterling" (13) -> 1 Fehler erlaubt
    expect(judgeAnswer(["Schmetterling"], "Schmetterlng").verdict).toBe("typo");
    // Vertauschte Buchstaben zählen als ein Fehler (Damerau).
    expect(judgeAnswer(["Gehirnwindung"], "Gehirnwindnug").verdict).toBe("typo");
    expect(judgeAnswer(["Gehirnwindung"], "Gehirnwndg").verdict).toBe("wrong");
  });

  it("requires exact spelling for short words", () => {
    expect(judgeAnswer(["Haus"], "Hous").verdict).toBe("wrong");
    expect(judgeAnswer(["Haus"], "Hau").verdict).toBe("wrong");
  });

  it("allows one error at exactly ten letters and not at nine", () => {
    expect(judgeAnswer(["abcdefghij"], "abcdefghix").verdict).toBe("typo");
    expect(judgeAnswer(["abcdefghi"], "abcdefghx").verdict).toBe("wrong");
  });

  it("matches any of several accepted meanings", () => {
    expect(judgeAnswer(splitAnswers("Haus; Gebäude, Heim"), "Gebäude").verdict).toBe("correct");
  });

  it("treats transposed letters as one error", () => {
    expect(editDistance("haus", "hasu")).toBe(1);
  });

  it("unifies Arabic and Persian letter variants and drops diacritics", () => {
    expect(normalizeAnswer("كتاب")).toBe(normalizeAnswer("کتاب"));
    expect(judgeAnswer(["کِتاب"], "کتاب").verdict).toBe("correct");
  });
});
