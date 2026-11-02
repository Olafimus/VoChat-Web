// Erzeugt die Zeichendaten für „Zeichen lernen“ (web/public/glyphs/<sprache>/).
//
// Quellen:
//   - KanjiVG (Strichpfade in Strichreihenfolge, 109×109-Raster) – CC BY-SA 3.0, https://kanjivg.tagaini.net
//   - kanji-data von David Gouveia (KANJIDIC2-Auszug mit neuen JLPT-Stufen) – MIT; KANJIDIC2: CC BY-SA 4.0 (EDRDG)
//     Verwendet werden nur die KANJIDIC-Felder (Striche, Schuljahr, Häufigkeit, JLPT, Bedeutungen, Lesungen).
//
// Aufruf (aus web/):
//   node scripts/build-glyph-data.mjs                         # lädt alles von raw.githubusercontent.com
//   node scripts/build-glyph-data.mjs --kanjivg <ordner>      # entpacktes KanjiVG-Release (Ordner mit 04e00.svg …)
//                                     --kanjidata <kanji.json>
//
// Ausgabe: index.json (alle Zeichen mit Kategorien) und strokes/<block>.json (Strichpfade, blockweise geladen).
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(web, "public", "glyphs", "ja");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};

const KANJIVG_RAW = "https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/";
const KANJIDATA_RAW = "https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json";
const BLOCK_SIZE = 150;

// Gojūon-Tabelle: [Zeichen-Reihe (Hiragana), Romaji]. Katakana = Hiragana + 0x60.
const KANA = [
  ["a", [["あ", "a"], ["い", "i"], ["う", "u"], ["え", "e"], ["お", "o"]]],
  ["ka", [["か", "ka"], ["き", "ki"], ["く", "ku"], ["け", "ke"], ["こ", "ko"]]],
  ["sa", [["さ", "sa"], ["し", "shi"], ["す", "su"], ["せ", "se"], ["そ", "so"]]],
  ["ta", [["た", "ta"], ["ち", "chi"], ["つ", "tsu"], ["て", "te"], ["と", "to"]]],
  ["na", [["な", "na"], ["に", "ni"], ["ぬ", "nu"], ["ね", "ne"], ["の", "no"]]],
  ["ha", [["は", "ha"], ["ひ", "hi"], ["ふ", "fu"], ["へ", "he"], ["ほ", "ho"]]],
  ["ma", [["ま", "ma"], ["み", "mi"], ["む", "mu"], ["め", "me"], ["も", "mo"]]],
  ["ya", [["や", "ya"], ["ゆ", "yu"], ["よ", "yo"]]],
  ["ra", [["ら", "ra"], ["り", "ri"], ["る", "ru"], ["れ", "re"], ["ろ", "ro"]]],
  ["wa", [["わ", "wa"], ["を", "wo"], ["ん", "n"]]],
  ["ga", [["が", "ga"], ["ぎ", "gi"], ["ぐ", "gu"], ["げ", "ge"], ["ご", "go"]]],
  ["za", [["ざ", "za"], ["じ", "ji"], ["ず", "zu"], ["ぜ", "ze"], ["ぞ", "zo"]]],
  ["da", [["だ", "da"], ["ぢ", "ji"], ["づ", "zu"], ["で", "de"], ["ど", "do"]]],
  ["ba", [["ば", "ba"], ["び", "bi"], ["ぶ", "bu"], ["べ", "be"], ["ぼ", "bo"]]],
  ["pa", [["ぱ", "pa"], ["ぴ", "pi"], ["ぷ", "pu"], ["ぺ", "pe"], ["ぽ", "po"]]],
];
const DAKUTEN_ROWS = new Set(["ga", "za", "da", "ba", "pa"]);

const hex = (c) => c.codePointAt(0).toString(16).padStart(5, "0");

async function fetchText(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      if (res.status === 404) return null;
    } catch {
      // erneut versuchen
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw new Error(`Download fehlgeschlagen: ${url}`);
}

const kanjivgDir = arg("--kanjivg");
async function loadSvg(c) {
  if (kanjivgDir) {
    const file = join(kanjivgDir, `${hex(c)}.svg`);
    return existsSync(file) ? readFileSync(file, "utf8") : null;
  }
  return fetchText(`${KANJIVG_RAW}${hex(c)}.svg`);
}

/** Strichpfade in Strichreihenfolge (id …-s1, -s2 …). */
function strokesFromSvg(svg) {
  const strokes = [];
  for (const m of svg.matchAll(/<path\b[^>]*\bid="kvg:[0-9a-f]+-s(\d+)"[^>]*>/g)) {
    const d = /\bd="([^"]+)"/.exec(m[0]);
    if (d) strokes.push([Number(m[1]), d[1].replace(/\s+/g, " ").trim()]);
  }
  return strokes.sort((a, b) => a[0] - b[0]).map(([, d]) => d);
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i], i);
      }
    }),
  );
  return results;
}

const kanjidataPath = arg("--kanjidata");
const kanjidata = JSON.parse(kanjidataPath ? readFileSync(kanjidataPath, "utf8") : await fetchText(KANJIDATA_RAW));

const glyphs = [];
for (const script of ["hiragana", "katakana"]) {
  for (const [row, chars] of KANA) {
    for (const [h, romaji] of chars) {
      const c = script === "hiragana" ? h : String.fromCodePoint(h.codePointAt(0) + 0x60);
      glyphs.push({ c, script, romaji, row, set: DAKUTEN_ROWS.has(row) ? "dakuten" : "basic" });
    }
  }
}

const clean = (list) => (list ?? []).filter((s) => !/^[!^]/.test(s));
const kanji = Object.entries(kanjidata)
  .filter(([, v]) => (v.grade && v.grade <= 8) || v.jlpt_new)
  .map(([c, v]) => ({
    c,
    script: "kanji",
    jlpt: v.jlpt_new ?? null,
    grade: v.grade ?? null,
    freq: v.freq ?? null,
    meanings: clean(v.meanings).filter((m) => !/radical \(no\.\s*\d+\)/i.test(m)).slice(0, 6),
    on: clean(v.readings_on).slice(0, 6),
    kun: clean(v.readings_kun).slice(0, 8),
  }))
  // Lernreihenfolge: N5 zuerst, innerhalb der Stufe nach Häufigkeit
  .sort((a, b) => (b.jlpt ?? 0) - (a.jlpt ?? 0) || (a.freq ?? 9999) - (b.freq ?? 9999) || (a.grade ?? 99) - (b.grade ?? 99));
glyphs.push(...kanji);

let done = 0;
const strokeData = await mapLimit(glyphs, kanjivgDir ? 64 : 16, async (g) => {
  const svg = await loadSvg(g.c);
  if (++done % 200 === 0) console.log(`${done}/${glyphs.length}`);
  return svg ? strokesFromSvg(svg) : null;
});

const index = [];
const blocks = new Map();
glyphs.forEach((g, i) => {
  const strokes = strokeData[i];
  if (!strokes || strokes.length === 0) {
    console.warn("ohne Strichdaten:", g.c);
    return;
  }
  const block = g.script === "kanji" ? `k${Math.floor(index.filter((x) => x.script === "kanji").length / BLOCK_SIZE)}` : "kana";
  if (!blocks.has(block)) blocks.set(block, {});
  blocks.get(block)[g.c] = strokes;
  index.push({ ...g, strokes: strokes.length, block });
});

if (existsSync(join(out, "strokes"))) rmSync(join(out, "strokes"), { recursive: true });
mkdirSync(join(out, "strokes"), { recursive: true });
for (const [name, data] of blocks) writeFileSync(join(out, "strokes", `${name}.json`), JSON.stringify(data));
writeFileSync(
  join(out, "index.json"),
  JSON.stringify({
    lang: "ja",
    generatedAt: new Date().toISOString().slice(0, 10),
    sources: [
      { name: "KanjiVG", url: "https://kanjivg.tagaini.net", license: "CC BY-SA 3.0" },
      { name: "KANJIDIC2 (EDRDG) via kanji-data", url: "https://github.com/davidluzgouveia/kanji-data", license: "CC BY-SA 4.0" },
    ],
    glyphs: index,
  }),
);
console.log(`Zeichen: ${index.length} (${blocks.size} Blöcke) → ${out}`);
