import { z } from "zod";
import { cefrSchema, langSchema } from "./schemas.js";

/** Gemeinsames Lernen: ein Wortschatz (Snapshot), Teilnehmende, Zeitraum, Rangliste. */
export const challengeItemSchema = z.object({
  lemma: z.string().trim().min(1).max(200),
  lang: langSchema,
  lexemeId: z.number().int().positive().nullable().default(null),
  gloss: z.string().max(500).nullable().default(null),
  pronunciation: z.string().max(200).nullable().default(null),
  cefr: cefrSchema.nullable().default(null),
});
export type ChallengeItem = z.infer<typeof challengeItemSchema>;

export const challengeCreateSchema = z.object({
  kind: z.enum(["duel", "group"]),
  title: z.string().trim().min(1).max(120),
  lang: langSchema,
  items: z.array(challengeItemSchema).min(1).max(500),
  days: z.number().int().min(1).max(60),
  invite: z.array(z.string().min(1).max(64)).min(1).max(20),
});

export interface LeaderboardEntry {
  userId: string | null;
  name: string;
  avatarUrl: string | null;
  isMe: boolean;
  known: number;
  learning: number;
  reviews: number;
  correct: number;
  points: number;
}

export interface ChallengeSummary {
  id: string;
  kind: "duel" | "group" | "weekly";
  title: string;
  lang: string;
  itemCount: number;
  startsAt: number;
  endsAt: number;
  myStatus: "invited" | "accepted" | "declined" | null;
  creatorName: string | null;
  members: number;
}

export interface ChallengeDetail extends ChallengeSummary {
  items: ChallengeItem[];
  leaderboard: LeaderboardEntry[];
  invited: { id: string; name: string }[];
}
