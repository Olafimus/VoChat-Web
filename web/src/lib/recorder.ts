/**
 * Kurze Sprachaufnahme im Browser: Mono, Rauschunterdrückung, Opus mit ~32 kbit/s (≈ 4 KB/s).
 * Stoppt automatisch nach `maxMs`. Safari kann kein WebM/Opus aufnehmen – dort AAC in MP4.
 */
export const MAX_RECORDING_MS = 5_000;
export const MAX_UPLOAD_BYTES = 250 * 1024;

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm"];

export const canRecord = (): boolean =>
  typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

export interface Recording {
  blob: Blob;
  durationMs: number;
  url: string;
}

export interface ActiveRecorder {
  stop(): void;
  done: Promise<Recording>;
}

export async function startRecording(maxMs = MAX_RECORDING_MS, onTick?: (ms: number) => void, bitsPerSecond = 32_000): Promise<ActiveRecorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });
  const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported?.(m));
  const rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: bitsPerSecond });
  const chunks: Blob[] = [];
  const started = performance.now();
  rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  const tick = setInterval(() => onTick?.(performance.now() - started), 100);
  const timeout = setTimeout(() => rec.state !== "inactive" && rec.stop(), maxMs);
  const done = new Promise<Recording>((resolve, reject) => {
    rec.onstop = () => {
      clearInterval(tick);
      clearTimeout(timeout);
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" });
      if (blob.size === 0) return reject(new Error("leer"));
      resolve({ blob, durationMs: Math.min(maxMs, Math.round(performance.now() - started)), url: URL.createObjectURL(blob) });
    };
    rec.onerror = () => reject(new Error("Aufnahme fehlgeschlagen"));
  });
  rec.start();
  return { stop: () => rec.state !== "inactive" && rec.stop(), done };
}
