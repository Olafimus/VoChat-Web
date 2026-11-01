import { useState } from "react";
import type { LangCode } from "@vochat/shared";
import { playPronunciation, type PlayResult } from "../lib/audio";
import { useDisplay } from "../lib/display";

const TITLE: Record<PlayResult, string> = {
  recording: "Aufnahme (Lingua Libre / Wikimedia Commons)",
  device: "Gerätestimme",
  generated: "Erzeugte Aussprache (eSpeak NG)",
  failed: "Aussprache nicht verfügbar (offline?)",
};

/** Lautsprecher-Knopf: spielt die Aussprache ab. Lange drücken bzw. Rechtsklick = langsam. */
export function SpeakButton({ lang, text, lexemeId }: { lang: LangCode; text: string; lexemeId?: number | null }) {
  const d = useDisplay();
  const [state, setState] = useState<{ busy: boolean; last: PlayResult | null }>({ busy: false, last: null });
  if (!d.audio) return null;
  const play = async (slow: boolean) => {
    setState((s) => ({ ...s, busy: true }));
    const last = await playPronunciation({ lang, text, lexemeId, mode: d.voice, slow });
    setState({ busy: false, last });
  };
  return (
    <button
      type="button"
      className={`speak ${state.busy ? "busy" : ""} ${state.last === "failed" ? "failed" : ""}`}
      aria-label={`„${text}“ anhören`}
      title={state.last ? TITLE[state.last] : "Anhören (Rechtsklick: langsam)"}
      onClick={(e) => {
        e.stopPropagation();
        void play(false);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void play(true);
      }}
    >
      {state.last === "failed" ? "🔇" : "🔊"}
    </button>
  );
}
