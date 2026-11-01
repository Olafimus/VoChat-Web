import { useEffect, useRef, useState } from "react";
import { IconPause, IconPlay } from "../icons";

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** Kompakter Player für Sprachnachrichten: Play/Pause, Fortschritt (klickbar), Dauer, Tempo 1×/1,5×. */
export function VoicePlayer({ src, durationMs }: { src: string; durationMs?: number }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(durationMs ?? 0);
  const [rate, setRate] = useState(1);

  useEffect(() => () => audio.current?.pause(), []);

  const ensure = () => {
    if (!audio.current) {
      const a = new Audio(src);
      a.preload = "metadata";
      a.ontimeupdate = () => setPos(a.currentTime * 1000);
      a.onloadedmetadata = () => Number.isFinite(a.duration) && setDur(a.duration * 1000);
      a.onended = () => {
        setPlaying(false);
        setPos(0);
      };
      a.onpause = () => setPlaying(false);
      a.onplay = () => setPlaying(true);
      audio.current = a;
    }
    return audio.current;
  };
  const toggle = () => {
    const a = ensure();
    a.playbackRate = rate;
    if (a.paused) void a.play().catch(() => setPlaying(false));
    else a.pause();
  };
  const pct = dur ? Math.min(100, (pos / dur) * 100) : 0;
  return (
    <div className="voice">
      <button type="button" className="voice-play" onClick={toggle} aria-label={playing ? "Pause" : "Sprachnachricht abspielen"}>
        {playing ? <IconPause size={16} fill="currentColor" /> : <IconPlay size={16} fill="currentColor" />}
      </button>
      <div
        className="voice-track"
        role="slider"
        aria-label="Position"
        aria-valuemin={0}
        aria-valuemax={Math.round(dur / 1000)}
        aria-valuenow={Math.round(pos / 1000)}
        tabIndex={0}
        onClick={(e) => {
          const a = ensure();
          const r = e.currentTarget.getBoundingClientRect();
          if (dur) a.currentTime = (((e.clientX - r.left) / r.width) * dur) / 1000;
        }}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="voice-time">{fmt(playing || pos ? pos : dur)}</span>
      <button
        type="button"
        className="voice-rate"
        onClick={() => {
          const next = rate === 1 ? 1.5 : rate === 1.5 ? 0.75 : 1;
          setRate(next);
          if (audio.current) audio.current.playbackRate = next;
        }}
        aria-label="Wiedergabetempo"
      >
        {String(rate).replace(".", ",")}×
      </button>
    </div>
  );
}
