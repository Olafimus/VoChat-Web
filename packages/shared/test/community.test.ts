import { describe, expect, it } from "vitest";
import { contributionPayloadSchema, grantSchema } from "../src/index.js";

describe("contribution payloads", () => {
  it("accepts a new lexeme with its first meaning", () => {
    const r = contributionPayloadSchema.safeParse({ kind: "lexeme", lang: "fa", lemma: "خانه", glossLang: "de", gloss: "Haus" });
    expect(r.success).toBe(true);
  });

  it("rejects retractions without a reason", () => {
    const r = contributionPayloadSchema.safeParse({ kind: "retract", target: "sense", targetId: 3, reason: "x" });
    expect(r.success).toBe(false);
  });

  it("rejects unknown kinds", () => {
    expect(contributionPayloadSchema.safeParse({ kind: "delete_everything" }).success).toBe(false);
  });

  it("validates role grants", () => {
    expect(grantSchema.safeParse({ email: "a@b.de", role: "expert", lang: "fa" }).success).toBe(true);
    expect(grantSchema.safeParse({ email: "a@b.de", role: "superuser" }).success).toBe(false);
  });
});
