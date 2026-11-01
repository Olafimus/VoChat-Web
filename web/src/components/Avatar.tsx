/** Profilbild mit Platzhalter (Initialen), falls kein Bild vorhanden ist oder es nicht lädt. */
import { useState } from "react";

export function Avatar({ name, url, size = 40 }: { name: string; url: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  const style = { width: size, height: size, fontSize: Math.round(size * 0.38) };
  if (url && !failed) {
    return <img className="avatar" src={url} alt="" style={style} onError={() => setFailed(true)} />;
  }
  return (
    <span className="avatar avatar-fallback" style={style} aria-hidden>
      {initials}
    </span>
  );
}
