import { useEffect, useState } from "react";
import type { LangCode, LexemeDetail, LexemeSummary } from "@vochat/shared";
import { api } from "../api/client";
import { useSession } from "../session";
import { CefrBadge, Lemma } from "./ui";

/** Vollansicht eines Eintrags: Bedeutungen, Übersetzungen, Beispielsätze, Kategorien. */
export function LexemeInfo({ lexeme, lang }: { lexeme: LexemeSummary; lang: LangCode }) {
  const { token } = useSession();
  const [detail, setDetail] = useState<LexemeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .lexeme(token, lexeme.id)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setError("Details nicht verfügbar (offline?)"));
    return () => {
      alive = false;
    };
  }, [token, lexeme.id]);

  if (error) return <div className="muted small">{error}</div>;
  if (!detail) return <div className="muted small">Lade Details …</div>;

  return (
    <div className="info">
      {detail.romanization && <div className="muted small">Aussprache: {detail.romanization}</div>}
      {detail.senses.length > 0 && (
        <ol className="senses">
          {detail.senses.slice(0, 12).map((s) => (
            <li key={`${s.glossLang}-${s.position}-${s.gloss}`}>
              {s.gloss}
              {s.glossLang !== "de" && <span className="muted small"> ({s.glossLang})</span>}
            </li>
          ))}
        </ol>
      )}
      {detail.translations.length > 0 && (
        <div className="small">
          <span className="muted">Übersetzungen: </span>
          {detail.translations.slice(0, 12).map((t) => `${t.targetLemma} (${t.targetLang})`).join(" · ")}
        </div>
      )}
      {detail.examples.length > 0 && (
        <ul className="examples">
          {detail.examples.slice(0, 6).map((e, i) => (
            <li key={i}>
              <Lemma lang={lang}>{e.text}</Lemma>
              {e.translation && <div className="muted small">{e.translation}</div>}
            </li>
          ))}
        </ul>
      )}
      {detail.categories.length > 0 && (
        <div className="chips">
          {detail.categories.slice(0, 12).map((c) => (
            <span key={c.name} className="chip">{c.name}</span>
          ))}
        </div>
      )}
      <CefrBadge level={detail.cefr} />
    </div>
  );
}
