import { z } from "zod";
import { CEFR_LEVELS, LANG_CODES } from "./languages.js";

export const langSchema = z.enum(LANG_CODES as [string, ...string[]]);
export const cefrSchema = z.enum(CEFR_LEVELS);
export const cardStatusSchema = z.enum(["new", "learning", "review", "mastered"]);

const timestamp = z.number().int().nonnegative();

/** Vokabelkarte des Nutzers – vollständig lokal nutzbar, wird synchronisiert. */
export const cardSchema = z.object({
  id: z.string().min(8).max(64),
  lang: langSchema,
  lemma: z.string().min(1).max(200),
  lexemeId: z.number().int().nullable(),
  gloss: z.string().max(500).nullable(),
  pronunciation: z.string().max(200).nullable().default(null),
  /** Felder, die der Nutzer selbst geändert hat. Sie werden beim Abgleich mit dem Wörterbuch nicht überschrieben. */
  custom: z.array(z.enum(["lemma", "gloss", "pronunciation", "cefr"])).max(4).default([]),
  note: z.string().max(2000),
  cefr: cefrSchema.nullable(),
  status: cardStatusSchema,
  ease: z.number().min(1.3).max(3),
  intervalDays: z.number().min(0),
  dueAt: timestamp,
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  /** Gedächtnismodell: Stabilität (Tage) und Schwierigkeit (1–10), aus der Historie berechnet. */
  stability: z.number().min(0).max(36500).default(0),
  difficulty: z.number().min(1).max(10).default(5),
  lastReviewAt: timestamp.nullable().default(null),
  /** Vom Nutzer ausgeblendet: wird nie geplant, bleibt aber in der Sammlung. */
  ignored: z.boolean().default(false),
  /** Eigene Zielquote für diese Karte (z. B. 0,95 = öfter üben), null = Standard. */
  retention: z.number().min(0.7).max(0.98).nullable().default(null),
  /** Vom Nutzer vorgezogen: kommt im nächsten Lernblock zuerst. */
  pinned: z.boolean().default(false),
  /** Fortschritt zurückgesetzt: Antworten davor zählen für das Gedächtnismodell nicht mehr. */
  resetAt: timestamp.nullable().default(null),
  /** Häufigkeitsrang aus dem Wörterbuch (kleiner = wichtiger). */
  rank: z.number().int().positive().nullable().default(null),
  /** Herkunft, z. B. "scan", "chat", "challenge:<id>", "collection:<id>" – fließt in die Priorität ein. */
  origin: z.string().max(80).nullable().default(null),
  createdAt: timestamp,
  updatedAt: timestamp,
  deleted: z.boolean(),
});
export type Card = z.infer<typeof cardSchema>;

/** Chat-Nachricht. `payload` trägt strukturierte Inhalte (z. B. Wörterbuch-Treffer). */
export const messageSchema = z.object({
  id: z.string().min(8).max(64),
  role: z.enum(["user", "assistant"]),
  kind: z.enum(["text", "lookup", "extract", "system"]),
  body: z.string().max(5000),
  payload: z.unknown().nullable(),
  createdAt: timestamp,
  /** Zeitpunkt der letzten Korrektur (null = nie korrigiert). */
  editedAt: timestamp.nullable().default(null),
  updatedAt: timestamp,
  deleted: z.boolean(),
});
export type Message = z.infer<typeof messageSchema>;

/** Ein protokolliertes Lernereignis (append-only, wird synchronisiert). */
export const reviewSchema = z.object({
  id: z.string().min(8).max(64),
  cardId: z.string().min(8).max(64),
  lang: langSchema,
  lemma: z.string().max(200),
  outcome: z.enum(["right", "wrong"]),
  /** Feinere Bewertung (nochmal/schwer/gut/leicht); ältere Einträge haben nur `outcome`. */
  grade: z.enum(["again", "hard", "good", "easy"]).nullable().default(null),
  /** Antwortzeit in ms (vom Anzeigen bis zur Antwort), sofern gemessen. */
  responseMs: z.number().int().min(0).max(3_600_000).nullable().default(null),
  /** "manual": vom Nutzer als bekannt markiert (keine echte Abfrage). */
  mode: z.enum(["flip", "reverse", "type", "manual"]),
  typed: z.string().max(200).nullable(),
  at: timestamp,
  updatedAt: timestamp,
  deleted: z.boolean(),
});
export type Review = z.infer<typeof reviewSchema>;

export const MEDIA_TYPES = ["book", "song", "film", "series", "other"] as const;

/** Lernpfad oder Medien-Wortschatz (Buch, Lied, Film …). Kann öffentlich geteilt werden. */
export const collectionSchema = z.object({
  id: z.string().min(8).max(64),
  kind: z.enum(["path", "media"]),
  mediaType: z.enum(MEDIA_TYPES).nullable(),
  title: z.string().min(1).max(160),
  description: z.string().max(2000),
  lang: langSchema,
  level: cefrSchema.nullable(),
  visibility: z.enum(["private", "public"]),
  ownerName: z.string().max(100),
  items: z
    .array(
      z.object({
        lemma: z.string().min(1).max(200),
        lang: langSchema,
        lexemeId: z.number().int().nullable(),
        gloss: z.string().max(500).nullable(),
        pronunciation: z.string().max(200).nullable().default(null),
        cefr: cefrSchema.nullable(),
      }),
    )
    .max(3000),
  createdAt: timestamp,
  updatedAt: timestamp,
  deleted: z.boolean(),
});
export type Collection = z.infer<typeof collectionSchema>;

export const SYNC_ENTITIES = ["cards", "messages", "reviews", "collections"] as const;
export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export const syncOpSchema = z.object({
  entity: z.enum(SYNC_ENTITIES),
  row: z.record(z.string(), z.unknown()),
});
export type SyncOp = z.infer<typeof syncOpSchema>;

export const pushRequestSchema = z.object({
  ops: z.array(syncOpSchema).max(500),
});

export const ratingSchema = z.object({ difficulty: z.number().int().min(1).max(5) });

export const registerSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(100),
  nativeLang: langSchema,
});

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  profilePublic: z.boolean().optional(),
  showProgress: z.boolean().optional(),
  nativeLang: langSchema.optional(),
  learnLangs: z
    .array(z.object({ lang: langSchema, targetCefr: cefrSchema.nullable() }))
    .max(10)
    .optional(),
});
