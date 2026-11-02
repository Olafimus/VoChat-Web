import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { applyGlyphAnswer, glyphId, type GlyphScript, type GlyphSkill, type Grade } from "@vochat/shared";
import { useSession } from "../session";
import type { Collections, GlyphRow } from "../local/collections";
import { readLearning } from "./learning";

/** Ein Zeichen aus web/public/glyphs/<sprache>/index.json (erzeugt von scripts/build-glyph-data.mjs). */
export interface GlyphInfo {
  c: string;
  script: GlyphScript;
  strokes: number;
  block: string;
  /** Kana */
  romaji?: string;
  row?: string;
  set?: "basic" | "dakuten";
  /** Kanji */
  jlpt?: number | null;
  grade?: number | null;
  freq?: number | null;
  meanings?: string[];
  on?: string[];
  kun?: string[];
}

interface GlyphIndex {
  lang: string;
  sources: { name: string; url: string; license: string }[];
  glyphs: GlyphInfo[];
}

const indexCache = new Map<string, Promise<GlyphIndex>>();
const blockCache = new Map<string, Promise<Record<string, string[]>>>();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function loadGlyphIndex(lang: string): Promise<GlyphIndex> {
  let p = indexCache.get(lang);
  if (!p) {
    p = fetchJson<GlyphIndex>(`/glyphs/${lang}/index.json`);
    p.catch(() => indexCache.delete(lang));
    indexCache.set(lang, p);
  }
  return p;
}

/** Strichpfade (SVG, Raster 109) eines Zeichens in Strichreihenfolge. Lädt den ganzen Block einmal. */
export async function loadStrokes(lang: string, glyph: Pick<GlyphInfo, "c" | "block">): Promise<string[]> {
  const key = `${lang}/${glyph.block}`;
  let p = blockCache.get(key);
  if (!p) {
    p = fetchJson<Record<string, string[]>>(`/glyphs/${lang}/strokes/${glyph.block}.json`);
    p.catch(() => blockCache.delete(key));
    blockCache.set(key, p);
  }
  const block = await p;
  const strokes = block[glyph.c];
  if (!strokes) throw new Error(`Keine Strichdaten für ${glyph.c}`);
  return strokes;
}

export function useGlyphIndex(lang: string): { glyphs: GlyphInfo[] | null; sources: GlyphIndex["sources"]; error: string | null } {
  const [state, setState] = useState<{ data: GlyphIndex | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    setState({ data: null, error: null });
    loadGlyphIndex(lang).then(
      (data) => alive && setState({ data, error: null }),
      () => alive && setState({ data: null, error: "Zeichendaten konnten nicht geladen werden (offline und noch nie geöffnet?)." }),
    );
    return () => {
      alive = false;
    };
  }, [lang]);
  return { glyphs: state.data?.glyphs ?? null, sources: state.data?.sources ?? [], error: state.error };
}

export function useGlyphStrokes(lang: string, glyph: GlyphInfo | null | undefined): string[] | null {
  const [strokes, setStrokes] = useState<{ c: string; paths: string[] } | null>(null);
  useEffect(() => {
    if (!glyph) return;
    let alive = true;
    loadStrokes(lang, glyph).then(
      (paths) => alive && setStrokes({ c: glyph.c, paths }),
      () => alive && setStrokes(null),
    );
    return () => {
      alive = false;
    };
  }, [lang, glyph?.c, glyph?.block]);
  return glyph && strokes?.c === glyph.c ? strokes.paths : null;
}

/** Lernstand aller Zeichen einer Sprache, nach Zeichen. */
export function useGlyphProgress(lang: string): Map<string, GlyphRow> {
  const { collections } = useSession();
  const rows = (useLiveQuery(() => collections.glyphs).data ?? []) as GlyphRow[];
  return useMemo(() => new Map(rows.filter((r) => !r.deleted && r.lang === lang).map((r) => [r.char, r])), [rows, lang]);
}

function upsertGlyph(collections: Collections, lang: string, glyph: GlyphInfo, change: (row: GlyphRow) => void): void {
  const now = Date.now();
  const id = glyphId(lang, glyph.c);
  const existing = (collections.glyphs.toArray as GlyphRow[]).find((r) => r.id === id);
  if (existing) {
    collections.glyphs.update(id, (d) => {
      change(d as GlyphRow);
      d.deleted = false;
      d.updatedAt = now;
    });
    return;
  }
  const row: GlyphRow = { id, lang, char: glyph.c, script: glyph.script, read: null, write: null, traces: 0, createdAt: now, updatedAt: now, deleted: false };
  change(row);
  void collections.glyphs.insert(row);
}

/** Antwort in einer Fertigkeit (Erkennen = read, Masterclass = write) ins Gedächtnismodell übernehmen. */
export function recordGlyphAnswer(collections: Collections, lang: string, glyph: GlyphInfo, skill: GlyphSkill, grade: Grade, mistakes = 0): void {
  const retention = readLearning().retention;
  upsertGlyph(collections, lang, glyph, (row) => {
    row[skill] = applyGlyphAnswer(row[skill] ?? null, grade, Date.now(), retention, row.id + skill, mistakes);
  });
}

export function recordTrace(collections: Collections, lang: string, glyph: GlyphInfo): void {
  upsertGlyph(collections, lang, glyph, (row) => {
    row.traces = (row.traces ?? 0) + 1;
  });
}

export function resetGlyph(collections: Collections, lang: string, glyph: GlyphInfo): void {
  upsertGlyph(collections, lang, glyph, (row) => {
    row.read = null;
    row.write = null;
    row.traces = 0;
  });
}

// ---------- Kategorien ----------

export interface GlyphCategory {
  id: string;
  label: string;
  group: string;
  hint?: string;
  /** Zeichen in Lernreihenfolge. */
  pick: (all: GlyphInfo[]) => GlyphInfo[];
}

const KANA_ROWS: [string, string][] = [
  ["a", "あ"], ["ka", "か"], ["sa", "さ"], ["ta", "た"], ["na", "な"], ["ha", "は"], ["ma", "ま"], ["ya", "や"], ["ra", "ら"], ["wa", "わ"],
  ["ga", "が"], ["za", "ざ"], ["da", "だ"], ["ba", "ば"], ["pa", "ぱ"],
];

const byFreq = (a: GlyphInfo, b: GlyphInfo) => (a.freq ?? 9999) - (b.freq ?? 9999);

export const SCRIPT_LABEL: Record<GlyphScript, string> = { hiragana: "Hiragana", katakana: "Katakana", kanji: "Kanji" };

export function categoriesFor(script: GlyphScript): GlyphCategory[] {
  const of = (all: GlyphInfo[]) => all.filter((g) => g.script === script);
  if (script !== "kanji") {
    const toKata = (s: string) => (script === "katakana" ? String.fromCodePoint(s.codePointAt(0)! + 0x60) : s);
    return [
      { id: "all", label: "Alle", group: "Auswahl", pick: of },
      { id: "basic", label: "Grundzeichen", group: "Auswahl", hint: "46 Zeichen der Gojūon-Tafel", pick: (a) => of(a).filter((g) => g.set === "basic") },
      { id: "dakuten", label: "Dakuten ゛゜", group: "Auswahl", hint: "stimmhafte Varianten (が, ぱ …)", pick: (a) => of(a).filter((g) => g.set === "dakuten") },
      ...KANA_ROWS.map(([row, c]) => ({ id: `row-${row}`, label: `${toKata(c)}-Reihe`, group: "Reihen", pick: (a: GlyphInfo[]) => of(a).filter((g) => g.row === row) })),
    ];
  }
  const jlpt = [5, 4, 3, 2, 1].map((n) => ({
    id: `n${n}`,
    label: `N${n}`,
    group: "JLPT",
    hint: n === 5 ? "Einstieg" : n === 1 ? "höchste Stufe" : undefined,
    pick: (a: GlyphInfo[]) => of(a).filter((g) => g.jlpt === n),
  }));
  const grades = [1, 2, 3, 4, 5, 6].map((n) => ({
    id: `g${n}`,
    label: `${n}. Klasse`,
    group: "Schuljahr (Kyōiku)",
    pick: (a: GlyphInfo[]) => of(a).filter((g) => g.grade === n).sort(byFreq),
  }));
  const freq = [100, 250, 500, 1000, 2500].map((n) => ({
    id: `top${n}`,
    label: `Top ${n}`,
    group: "Häufigkeit",
    hint: "nach Häufigkeit in Zeitungstexten",
    pick: (a: GlyphInfo[]) => of(a).filter((g) => g.freq != null).sort(byFreq).slice(0, n),
  }));
  return [
    ...jlpt,
    ...freq,
    ...grades,
    { id: "secondary", label: "Mittelstufe (Jōyō)", group: "Schuljahr (Kyōiku)", hint: "übrige Jōyō-Kanji", pick: (a) => of(a).filter((g) => g.grade === 8).sort(byFreq) },
    { id: "all", label: "Alle", group: "Weitere", pick: of },
  ];
}

/** Antwort beim Erkennen: Kana → Romaji, Kanji → erste Bedeutung. */
export const glyphAnswer = (g: GlyphInfo): string => (g.script === "kanji" ? (g.meanings?.[0] ?? "") : (g.romaji ?? ""));

/** Kun-Lesung lesbar: „ひと.つ“ → „ひと(つ)“, „-び“ bleibt. */
export const formatKun = (k: string): string => k.replace(/\.(.+)$/, "($1)");
