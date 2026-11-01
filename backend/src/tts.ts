import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LangCode } from "@vochat/shared";

/**
 * Erzeugte Aussprache, wenn es keine Aufnahme gibt: eSpeak NG (GPL-3, Emscripten-Port, ohne
 * Systempakete). Klingt synthetisch, ist aber für alle Sprachen offline verfügbar.
 * Ergebnisse werden im Speicher und – falls ein Verzeichnis gesetzt ist – auf der Platte
 * zwischengespeichert; derselbe Text wird also nur einmal synthetisiert.
 */
const VOICES: Record<LangCode, string> = { de: "de", en: "en-us", es: "es", fa: "fa", ja: "ja" };
export const TTS_MAX_CHARS = 200;

interface Worker {
  set_voice(name: string, lang: string): number;
  set_rate(rate: number): void;
  readonly samplerate: number;
  synthesize(text: string, cb: (samples: Int16Array, events: unknown[]) => boolean): number;
  synthesize_and_get_phonemes(text: string, cb: (samples: Int16Array, events: unknown[]) => boolean): string;
}
type ESpeakModule = { eSpeakNGWorker: new () => Worker };

let worker: Promise<Worker> | null = null;
const loadWorker = () =>
  (worker ??= import("@echogarden/espeak-ng-emscripten").then(async (m) => {
    const mod = (await m.default({ print: () => {}, printErr: () => {} })) as ESpeakModule;
    return new mod.eSpeakNGWorker();
  }));

/** 16-Bit-Mono-PCM in eine WAV-Datei verpacken. */
export function pcmToWav(chunks: Int16Array[], sampleRate: number): Uint8Array {
  const samples = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(44 + samples * 2);
  const v = new DataView(out.buffer);
  const str = (o: number, t: string) => [...t].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples * 2, true);
  let o = 44;
  for (const c of chunks) for (const x of c) (v.setInt16(o, x, true), (o += 2));
  return out;
}

export function normalizeTtsText(text: string): string {
  // Kein Steuerzeichen, keine führenden Bindestriche (würden als Option gelesen).
  return text.replace(/[\p{Cc}]/gu, " ").replace(/\s+/g, " ").trim().replace(/^-+/, "").slice(0, TTS_MAX_CHARS);
}

export class Tts {
  private memory = new Map<string, Uint8Array>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private cacheDir: string | null = null, private maxMemory = 300) {}

  private key(lang: LangCode, text: string, speed: number) {
    return createHash("sha256").update(`${lang}\0${speed}\0${text}`).digest("hex").slice(0, 32);
  }

  /** IPA-Umschrift (generiert) – Hilfe, wo das Wörterbuch keine Aussprache hat. */
  async ipa(lang: LangCode, rawText: string): Promise<string | null> {
    const text = normalizeTtsText(rawText);
    if (!text) return null;
    const run = this.queue.then(async () => {
      const w = await loadWorker();
      w.set_voice(VOICES[lang], VOICES[lang]);
      const ipa = w.synthesize_and_get_phonemes(text, () => false);
      return typeof ipa === "string" ? ipa.replace(/\s+/g, " ").trim() || null : null;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async synthesize(lang: LangCode, rawText: string, slow = false): Promise<Uint8Array | null> {
    const text = normalizeTtsText(rawText);
    if (!text) return null;
    const speed = slow ? 110 : 150;
    const key = this.key(lang, text, speed);
    const hit = this.memory.get(key);
    if (hit) return hit;
    if (this.cacheDir) {
      try {
        const file = await readFile(join(this.cacheDir, `${key}.wav`));
        this.remember(key, file);
        return file;
      } catch {
        /* nicht im Cache */
      }
    }
    // Nacheinander synthetisieren: der eine WASM-Worker ist nicht reentrant.
    const run = this.queue.then(async () => {
      const w = await loadWorker();
      w.set_voice(VOICES[lang], VOICES[lang]);
      w.set_rate(speed);
      const chunks: Int16Array[] = [];
      w.synthesize(text, (samples) => {
        if (samples?.length) chunks.push(samples);
        return false; // weiter
      });
      return pcmToWav(chunks, w.samplerate);
    });
    this.queue = run.catch(() => undefined);
    const wav = await run;
    if (wav.length <= 44) return null;
    this.remember(key, wav);
    if (this.cacheDir) {
      await mkdir(this.cacheDir, { recursive: true });
      await writeFile(join(this.cacheDir, `${key}.wav`), wav).catch(() => undefined);
    }
    return wav;
  }

  private remember(key: string, wav: Uint8Array) {
    this.memory.set(key, wav);
    if (this.memory.size > this.maxMemory) this.memory.delete(this.memory.keys().next().value as string);
  }
}
