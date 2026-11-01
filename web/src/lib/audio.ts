import type { AudioRecording, LangCode } from "@vochat/shared";
import { apiUrl } from "../api/client";

/**
 * Aussprache abspielen, in dieser Reihenfolge:
 *  1. echte Aufnahme (Lingua Libre / Wikimedia Commons, freie Lizenz) – falls das Wort eine hat,
 *  2. Stimme des Geräts (Web Speech API, offline, oft sehr gut auf Handys),
 *  3. vom Server erzeugt (eSpeak NG) – klingt synthetisch, ist aber für alle Sprachen da.
 * Die Einstellung „voice“ kann 2 oder 3 erzwingen.
 */
export type VoiceMode = "auto" | "device" | "generated";

const BCP47: Record<LangCode, string> = { de: "de-DE", en: "en-US", es: "es-ES", fa: "fa-IR", ja: "ja-JP" };
const recordingCache = new Map<number, Promise<AudioRecording[]>>();
let current: HTMLAudioElement | null = null;

export function deviceVoice(lang: LangCode): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === BCP47[lang]) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang)) ?? null;
}

function recordings(lexemeId: number): Promise<AudioRecording[]> {
  let hit = recordingCache.get(lexemeId);
  if (!hit) {
    hit = fetch(apiUrl(`/audio/lexemes/${lexemeId}`))
      .then((r) => (r.ok ? (r.json() as Promise<{ recordings: AudioRecording[] }>) : { recordings: [] }))
      .then((r) => r.recordings)
      .catch(() => {
        recordingCache.delete(lexemeId); // offline: später erneut versuchen
        return [];
      });
    recordingCache.set(lexemeId, hit);
  }
  return hit;
}

function playUrl(url: string): Promise<boolean> {
  current?.pause();
  const audio = new Audio(url);
  current = audio;
  return audio.play().then(
    () => true,
    () => false,
  );
}

function speak(lang: LangCode, text: string, slow: boolean): boolean {
  const voice = deviceVoice(lang);
  if (!voice) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = slow ? 0.7 : 0.95;
  speechSynthesis.speak(u);
  return true;
}

export type PlayResult = "recording" | "device" | "generated" | "failed";

export async function playPronunciation(opts: {
  lang: LangCode;
  text: string;
  lexemeId?: number | null;
  mode?: VoiceMode;
  slow?: boolean;
}): Promise<PlayResult> {
  const { lang, text, lexemeId, mode = "auto", slow = false } = opts;
  if (!text.trim()) return "failed";
  if (mode === "auto" && lexemeId && !slow) {
    const recs = await recordings(lexemeId);
    if (recs.length > 0 && (await playUrl(apiUrl(recs[0].url)))) return "recording";
  }
  if (mode !== "generated" && speak(lang, text, slow)) return "device";
  if (mode === "device" && typeof speechSynthesis !== "undefined" && speechSynthesis.getVoices().length > 0) return "failed";
  const url = apiUrl(`/audio/tts?lang=${lang}&text=${encodeURIComponent(text.slice(0, 200))}${slow ? "&slow=1" : ""}`);
  return (await playUrl(url)) ? "generated" : "failed";
}

// Manche Browser laden die Stimmenliste erst asynchron.
if (typeof speechSynthesis !== "undefined") speechSynthesis.getVoices();

const ipaCache = new Map<string, Promise<string | null>>();

/** Erzeugte Lautschrift (eSpeak NG) für Wörter ohne Aussprache-Angabe; null offline/bei Fehler. */
export function generatedIpa(lang: LangCode, text: string): Promise<string | null> {
  const key = `${lang}:${text}`;
  let hit = ipaCache.get(key);
  if (!hit) {
    hit = fetch(apiUrl(`/audio/ipa?lang=${lang}&text=${encodeURIComponent(text.slice(0, 100))}`))
      .then((r) => (r.ok ? (r.json() as Promise<{ ipa: string | null }>) : { ipa: null }))
      .then((r) => r.ipa)
      .catch(() => {
        ipaCache.delete(key);
        return null;
      });
    ipaCache.set(key, hit);
  }
  return hit;
}
