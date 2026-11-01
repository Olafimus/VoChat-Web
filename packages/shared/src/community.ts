import { z } from "zod";
import { cefrSchema, langSchema } from "./schemas.js";

/**
 * Community-Beiträge zum Wörterbuch. Jeder Beitrag wird geprüft (Verifizieren/Falsifizieren),
 * bevor er im Wörterbuch erscheint. Experten einer Sprache entscheiden verbindlich.
 */
export const ROLES = ["admin", "expert"] as const;
export type Role = (typeof ROLES)[number];

export const RETRACTABLE = ["lexeme", "sense", "example", "translation"] as const;

const id = z.number().int().positive();

export const contributionPayloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("lexeme"),
    lang: langSchema,
    lemma: z.string().trim().min(1).max(200),
    pos: z.string().trim().max(40).default(""),
    gender: z.enum(["m", "f", "n"]).nullable().default(null),
    cefr: cefrSchema.nullable().default(null),
    glossLang: langSchema,
    gloss: z.string().trim().min(1).max(500),
  }),
  z.object({
    kind: z.literal("pronunciation"),
    lexemeId: id,
    romanization: z.string().trim().min(1).max(200),
  }),
  z.object({
    kind: z.literal("sense"),
    lexemeId: id,
    glossLang: langSchema,
    gloss: z.string().trim().min(1).max(500),
  }),
  z.object({
    kind: z.literal("example"),
    lexemeId: id,
    text: z.string().trim().min(1).max(500),
    translation: z.string().trim().max(500).nullable().default(null),
    translationLang: langSchema.nullable().default(null),
  }),
  z.object({
    kind: z.literal("translation"),
    lexemeId: id,
    targetLang: langSchema,
    targetLemma: z.string().trim().min(1).max(200),
  }),
  z.object({
    kind: z.literal("retract"),
    target: z.enum(RETRACTABLE),
    targetId: id,
    reason: z.string().trim().min(3).max(300),
  }),
]);
export type ContributionPayload = z.infer<typeof contributionPayloadSchema>;

export const submitSchema = z.object({ payload: contributionPayloadSchema });

export const voteSchema = z.object({ vote: z.enum(["verify", "reject"]) });
export const decideSchema = z.object({ decision: z.enum(["verify", "reject", "revoke"]) });

export const grantSchema = z.object({
  email: z.email().max(254),
  role: z.enum(ROLES),
  lang: langSchema.nullable().default(null),
});

export type ContributionStatus = "pending" | "verified" | "rejected" | "revoked";
