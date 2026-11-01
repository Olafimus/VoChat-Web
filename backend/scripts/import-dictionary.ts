/**
 * Wörterbuch-Import.
 *
 *   npm run import:dictionary -- starter                 # alle Quellen des Presets
 *   npm run import:dictionary -- frequency --lang de --url <url|file>
 *   npm run import:dictionary -- wordhoard --lang de --file data/sources/wordhoard-de-top2000.csv
 *   npm run import:dictionary -- kaikki --lang de --gloss-lang en --file German.jsonl
 *   npm run import:dictionary -- freedict --from es --to en --file spa-eng.tei
 *   npm run import:dictionary -- legacy-fa-de --file data/sources/legacy-fa-de.json
 *
 * Optionen: --db <ziel> (Standard: DATABASE_URL oder data/vochat.db), --limit <n> (Häufigkeit).
 * Entfernte Dateien (http/https) werden nach data/cache geladen.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, type Db } from "../src/db/index.js";
import { importFrequency } from "../src/importers/frequency.js";
import { importWordhoard } from "../src/importers/wordhoard.js";
import { importKaikki } from "../src/importers/kaikki.js";
import { importFreedict } from "../src/importers/freedict.js";
import { importLegacyFaDe } from "../src/importers/legacy-fa-de.js";

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(here, "..");
const cacheDir = join(backendDir, "data", "cache");
const sourcesDir = join(backendDir, "data", "sources");

const FREQ_BASE = "https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018";
const FREEDICT_BASE = "https://raw.githubusercontent.com/freedict/fd-dictionaries/master";

/** Was `starter` lädt: alles, was aus dem Repo / lokalen Quellen ohne Riesen-Downloads erreichbar ist. */
const STARTER: { run: string; args: string[] }[] = [
  ...["de", "en", "es"].map((lang) => ({ run: "wordhoard", args: ["--lang", lang, "--file", join(sourcesDir, `wordhoard-${lang}-top2000.csv`)] })),
  { run: "freedict", args: ["--from", "es", "--to", "en", "--url", `${FREEDICT_BASE}/spa-eng/spa-eng.tei`] },
  { run: "legacy-fa-de", args: ["--file", join(sourcesDir, "legacy-fa-de.json")] },
  // Häufigkeiten zuletzt: sie ordnen vorhandenen Lemmata nur Ränge zu.
  ...["de", "en", "es", "fa"].map((lang) => ({ run: "frequency", args: ["--lang", lang, "--url", `${FREQ_BASE}/${lang}/${lang}_50k.txt`] })),
];

function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith("--")) flags[rest[i].slice(2)] = rest[i + 1] ?? "";
    if (rest[i].startsWith("--")) i++;
  }
  return { command, flags };
}

async function readSource(flags: Record<string, string>): Promise<{ path: string; text: string }> {
  const location = flags.url ?? flags.file;
  if (!location) throw new Error("--file oder --url fehlt");
  if (/^https?:\/\//.test(location)) {
    mkdirSync(cacheDir, { recursive: true });
    const target = join(cacheDir, basename(new URL(location).pathname) || "download");
    if (!existsSync(target)) {
      console.log(`  lade ${location}`);
      const res = await fetch(location);
      if (!res.ok) throw new Error(`Download fehlgeschlagen (${res.status}): ${location}`);
      writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    } else console.log(`  nutze Cache ${target}`);
    return { path: target, text: readFileSync(target, "utf8") };
  }
  return { path: location, text: readFileSync(location, "utf8") };
}

async function runOne(db: Db, command: string, flags: Record<string, string>): Promise<void> {
  const src = command === "legacy-fa-de" ? null : await readSource(flags);
  switch (command) {
    case "frequency": {
      const n = await importFrequency(db, flags.lang, src!.text, src!.path, Number(flags.limit ?? 50000));
      console.log(`  frequency ${flags.lang}: ${n} Wörter`);
      return;
    }
    case "wordhoard": {
      const n = await importWordhoard(db, flags.lang, src!.text, src!.path);
      console.log(`  wordhoard ${flags.lang}: ${n} Zeilen`);
      return;
    }
    case "kaikki": {
      const n = await importKaikki(db, { lang: flags.lang, glossLang: flags["gloss-lang"] ?? "en", file: src!.path, text: src!.text });
      console.log(`  kaikki ${flags.lang}: ${n} Einträge`);
      return;
    }
    case "freedict": {
      const n = await importFreedict(db, { from: flags.from, to: flags.to, file: src!.path, xml: src!.text });
      console.log(`  freedict ${flags.from}-${flags.to}: ${n} Einträge`);
      return;
    }
    case "legacy-fa-de": {
      const path = flags.file ?? join(sourcesDir, "legacy-fa-de.json");
      const n = await importLegacyFaDe(db, path, readFileSync(path, "utf8"));
      console.log(`  legacy fa-de: ${n} Vokabeln`);
      return;
    }
    default:
      throw new Error(`Unbekannter Befehl: ${command}`);
  }
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (!command) throw new Error("Befehl fehlt (starter | frequency | wordhoard | kaikki | freedict | legacy-fa-de)");
  const target = flags.db ?? process.env.DATABASE_URL ?? process.env.DB_PATH ?? "data/vochat.db";
  const db = await openDatabase(/^(postgres|pglite:)/.test(target) ? target : resolve(backendDir, target));
  const started = Date.now();

  if (command === "starter") {
    for (const step of STARTER) {
      console.log(`→ ${step.run} ${step.args.join(" ")}`);
      await runOne(db, step.run, parseArgs([step.run, ...step.args]).flags);
    }
  } else {
    await runOne(db, command, flags);
  }
  console.log(`fertig in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  await db.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
