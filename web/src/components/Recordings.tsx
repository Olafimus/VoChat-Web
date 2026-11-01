import { useEffect, useRef, useState } from "react";
import type { AudioRecording } from "@vochat/shared";
import { ApiError, apiUrl, recordings } from "../api/client";
import { useSession } from "../session";
import { canRecord, MAX_RECORDING_MS, MAX_UPLOAD_BYTES, startRecording, type ActiveRecorder, type Recording } from "../lib/recorder";

const play = (url: string) => void new Audio(apiUrl(url)).play().catch(() => undefined);

/**
 * Aufnahmen zu einem Wort: anhören (Lingua Libre, Community) und selbst einsprechen (max. 5 s).
 * Eigene Aufnahmen hört man sofort; für alle sichtbar werden sie nach Freigabe durch Experten.
 */
export function Recordings({ lexemeId, lemma }: { lexemeId: number; lemma: string }) {
  const { token } = useSession();
  const [list, setList] = useState<AudioRecording[] | null>(null);
  const [uploads, setUploads] = useState(false);
  const [active, setActive] = useState<ActiveRecorder | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [take, setTake] = useState<Recording | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const takeRef = useRef<Recording | null>(null);
  takeRef.current = take;

  const load = () =>
    recordings
      .list(lexemeId, token)
      .then((r) => {
        setList(r.recordings);
        setUploads(r.uploads);
      })
      .catch(() => setList([]));
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lexemeId, token]);
  useEffect(
    () => () => {
      if (takeRef.current) URL.revokeObjectURL(takeRef.current.url);
    },
    [],
  );

  const record = async () => {
    setMsg(null);
    if (take) URL.revokeObjectURL(take.url);
    setTake(null);
    try {
      const r = await startRecording(MAX_RECORDING_MS, setElapsed);
      setActive(r);
      const result = await r.done;
      setTake(result);
    } catch (e) {
      setMsg(e instanceof DOMException && e.name === "NotAllowedError" ? "Mikrofon nicht erlaubt." : "Aufnahme nicht möglich.");
    } finally {
      setActive(null);
      setElapsed(0);
    }
  };

  const upload = async () => {
    if (!take || !token) return;
    if (take.blob.size > MAX_UPLOAD_BYTES) return setMsg("Aufnahme zu groß.");
    try {
      const rec = await recordings.upload(token, lexemeId, take.blob, take.durationMs);
      URL.revokeObjectURL(take.url);
      setTake(null);
      setMsg(rec.status === "approved" ? "Gespeichert und freigegeben." : "Gespeichert – für andere sichtbar, sobald Experten sie freigeben.");
      void load();
    } catch (e) {
      setMsg(
        e instanceof ApiError
          ? e.status === 0
            ? "Offline – bitte später hochladen."
            : e.status === 429
              ? "Tageslimit für Aufnahmen erreicht."
              : e.status === 503
                ? "Aufnahmen sind auf diesem Server noch nicht aktiviert."
                : "Hochladen fehlgeschlagen."
          : "Hochladen fehlgeschlagen.",
      );
    }
  };

  const remove = async (id: number) => {
    if (!token) return;
    await recordings.remove(token, id).catch(() => undefined);
    void load();
  };

  const others = list ?? [];
  return (
    <div className="recordings stack">
      <div className="row wrap">
        <b className="small">Aussprache</b>
        {others.length === 0 && list !== null && <span className="muted small">noch keine Aufnahme</span>}
        {others.map((r) => (
          <span key={r.id ?? r.url} className="rec-chip">
            <button className="small-btn" onClick={() => play(r.url)} aria-label={`Aufnahme von ${r.speaker ?? "unbekannt"} abspielen`}>
              🔊 {r.mine ? "du" : r.speaker ?? (r.source.startsWith("commons") || r.source.startsWith("kaikki") ? "Wikimedia" : "Community")}
            </button>
            {r.status === "pending" && <span className="badge subtle">wartet auf Freigabe</span>}
            {r.mine && r.id && (
              <button className="link small danger" onClick={() => remove(r.id!)} aria-label="Eigene Aufnahme löschen">✕</button>
            )}
          </span>
        ))}
      </div>
      {token && uploads && canRecord() && (
        <div className="row wrap">
          {!active ? (
            <button className="small-btn" onClick={() => void record()}>🎙 {others.some((r) => r.mine) ? "Neu aufnehmen" : `„${lemma}“ einsprechen`}</button>
          ) : (
            <button className="small-btn primary recording" onClick={() => active.stop()}>
              ■ Stopp ({((MAX_RECORDING_MS - elapsed) / 1000).toFixed(1).replace(".", ",")} s)
            </button>
          )}
          {take && (
            <>
              <button className="small-btn" onClick={() => void new Audio(take.url).play()}>▶ Anhören</button>
              <button className="small-btn primary" onClick={() => void upload()}>Speichern</button>
              <button className="link small" onClick={() => { URL.revokeObjectURL(take.url); setTake(null); }}>Verwerfen</button>
              <span className="muted small">{(take.durationMs / 1000).toFixed(1).replace(".", ",")} s · {Math.round(take.blob.size / 1024)} KB</span>
            </>
          )}
        </div>
      )}
      {!token && <span className="muted small">Mit Konto kannst du eigene Aufnahmen beisteuern.</span>}
      {msg && <span className="muted small" role="status">{msg}</span>}
    </div>
  );
}
