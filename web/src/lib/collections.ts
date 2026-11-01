import type { LangCode, MEDIA_TYPES } from "@vochat/shared";
import type { MediaCollectionRow } from "../local/collections";
import { newId } from "./ids";

export interface ItemDraft {
  lemma: string;
  lang: LangCode;
  lexemeId: number | null;
  gloss: string | null;
  cefr: string | null;
}

/**
 * Eingabe pro Zeile: "wort" oder "wort = bedeutung". Leere Zeilen und Duplikate fallen weg.
 */
export function parseItemLines(text: string, lang: LangCode): ItemDraft[] {
  const seen = new Set<string>();
  const items: ItemDraft[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [lemmaPart, ...glossParts] = line.split("=");
    const lemma = lemmaPart.trim();
    if (!lemma) continue;
    const k = lemma.toLocaleLowerCase("de");
    if (seen.has(k)) continue;
    seen.add(k);
    const gloss = glossParts.join("=").trim();
    items.push({ lemma, lang, lexemeId: null, gloss: gloss || null, cefr: null });
  }
  return items;
}

export function newMediaCollection(input: {
  kind: "path" | "media";
  mediaType: (typeof MEDIA_TYPES)[number] | null;
  title: string;
  description: string;
  lang: LangCode;
  level: string | null;
  visibility: "private" | "public";
  ownerName: string;
  items: ItemDraft[];
}): MediaCollectionRow {
  const now = Date.now();
  return { id: newId(), ...input, createdAt: now, updatedAt: now, deleted: false };
}
