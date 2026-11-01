import { lemmaKey, type LangCode } from "@vochat/shared";
import type { Db } from "../db/index.js";
import { addAudio, recordRun } from "./common.js";

/**
 * Aussprache-Aufnahmen von Lingua Libre (Wikimedia Commons). Lingua Libre ist ein offenes Projekt,
 * in dem Freiwillige Wörter einsprechen; die Dateien stehen meist unter CC BY-SA 4.0.
 * Wir speichern nur Link, Lizenz und Sprecher – abgespielt wird direkt von upload.wikimedia.org.
 */
export const COMMONS_LANG: Record<LangCode, string> = { de: "deu", en: "eng", es: "spa", fa: "fas", ja: "jpn" };

/** „File:LL-Q188 (deu)-Sprecher-Wort.wav“ → Wort + Sprecher. Das Wort darf Bindestriche enthalten. */
export function parseCommonsFile(title: string): { word: string; speaker: string } | null {
  const m = /^(?:File:)?LL-Q\d+ \([a-z]{3}\)-([^-]+)-(.+)\.(?:wav|ogg|flac|mp3)$/i.exec(title);
  if (!m) return null;
  const word = m[2].replace(/_/g, " ").trim();
  return word ? { word, speaker: m[1] } : null;
}

/** Commons transkodiert WAV/OGG zusätzlich als MP3 (spielt auch in Safari/iOS). */
export function commonsMp3(url: string): string {
  const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons)\/([0-9a-f])\/([0-9a-f]{2})\/([^/]+)$/.exec(url);
  if (!m || /\.mp3$/i.test(m[4])) return url;
  return `${m[1]}/transcoded/${m[2]}/${m[3]}/${m[4]}/${m[4]}.mp3`;
}

interface CommonsPage {
  title: string;
  imageinfo?: { url: string; extmetadata?: { LicenseShortName?: { value: string } } }[];
}

/**
 * Lädt die Kategorie „Lingua Libre pronunciation-<iso3>“ seitenweise und verknüpft jede Aufnahme mit
 * den Lexemen, deren Wortschlüssel passt. Wörter ohne Lexem werden übersprungen.
 */
export async function importCommonsAudio(
  db: Db,
  opts: { lang: LangCode; maxFiles?: number; fetchImpl?: typeof fetch; log?: (msg: string) => void },
): Promise<number> {
  const doFetch = opts.fetchImpl ?? fetch;
  const max = opts.maxFiles ?? 50_000;
  const source = `commons:${opts.lang}`;
  let cont: Record<string, string> = {};
  let seen = 0;
  let linked = 0;
  while (seen < max) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "categorymembers",
      gcmtitle: `Category:Lingua Libre pronunciation-${COMMONS_LANG[opts.lang]}`,
      gcmtype: "file",
      gcmlimit: "500",
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiextmetadatafilter: "LicenseShortName",
      ...cont,
    });
    const res = await doFetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { "user-agent": "VoChat dictionary importer (self-hosted)" },
    });
    if (!res.ok) throw new Error(`Commons antwortet ${res.status}`);
    const body = (await res.json()) as { query?: { pages?: Record<string, CommonsPage> }; continue?: Record<string, string> };
    const pages = Object.values(body.query?.pages ?? {});
    for (const page of pages) {
      seen++;
      const parsed = parseCommonsFile(page.title);
      const info = page.imageinfo?.[0];
      if (!parsed || !info?.url) continue;
      const ids = await db.all<{ id: number }>("SELECT id FROM lexemes WHERE lang = ? AND lemma_key = ?", [opts.lang, lemmaKey(parsed.word)]);
      for (const { id } of ids) {
        await addAudio(db, Number(id), {
          url: commonsMp3(info.url),
          source,
          license: info.extmetadata?.LicenseShortName?.value ?? "CC BY-SA 4.0",
          speaker: parsed.speaker,
        });
        linked++;
      }
    }
    opts.log?.(`  ${seen} Dateien gelesen, ${linked} verknüpft`);
    if (!body.continue) break;
    cont = body.continue;
  }
  await recordRun(db, "commons-audio", opts.lang, "commons.wikimedia.org", linked);
  return linked;
}
