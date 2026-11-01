import { describe, expect, it } from "vitest";
import { cardSchema, registerSchema } from "../src/index.js";

describe("schemas", () => {
  it("rejects unknown languages on registration", () => {
    const result = registerSchema.safeParse({
      email: "a@b.de",
      password: "longenough",
      name: "Olaf",
      nativeLang: "xx",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a well-formed card", () => {
    const card = {
      id: "0123456789abcdef",
      lang: "fa",
      lemma: "آب",
      lexemeId: null,
      gloss: "Wasser",
      note: "",
      cefr: "A1",
      status: "new",
      ease: 2.5,
      intervalDays: 0,
      dueAt: 0,
      reps: 0,
      lapses: 0,
      createdAt: 1,
      updatedAt: 1,
      deleted: false,
    };
    expect(cardSchema.safeParse(card).success).toBe(true);
  });
});
