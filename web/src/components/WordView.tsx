import { useEffect, useState } from "react";
import type { LangCode } from "@vochat/shared";
import { generatedIpa } from "../lib/audio";
import { useDisplay } from "../lib/display";
import { CefrBadge, Lemma } from "./ui";
import { SpeakButton } from "./SpeakButton";

/**
 * Einheitliche Darstellung eines Wortes: Lemma, Aussprache, Bedeutung, Niveau, Wortart, Genus.
 * Was davon erscheint, bestimmen die Anzeige-Einstellungen im Profil.
 */
export function WordView({
  lemma,
  lang,
  pronunciation,
  gloss,
  cefr,
  pos,
  gender,
  large,
  lexemeId,
}: {
  lemma: string;
  lang: LangCode;
  pronunciation?: string | null;
  gloss?: string | null;
  cefr?: string | null;
  pos?: string | null;
  gender?: string | null;
  large?: boolean;
  lexemeId?: number | null;
}) {
  const d = useDisplay();
  const pron = d.pronunciation ? pronunciation : null;
  // Aussprache fehlt bei Persisch und Japanisch: sichtbar als Hinweis, damit klar ist, dass etwas fehlt.
  const missingPron = d.pronunciation && !pronunciation && (lang === "fa" || lang === "ja");
  const [ipa, setIpa] = useState<string | null>(null);
  useEffect(() => {
    if (!missingPron) return;
    let live = true;
    void generatedIpa(lang, lemma).then((v) => live && setIpa(v));
    return () => {
      live = false;
    };
  }, [missingPron, lang, lemma]);
  const cls = `word-view ${large || d.size === "large" ? "word-large" : ""} ${d.pronunciationInline ? "" : "word-stacked"}`;
  return (
    <span className={cls}>
      <Lemma lang={lang}>{lemma}</Lemma>
      <SpeakButton lang={lang} text={lemma} lexemeId={lexemeId} />
      {(pron || missingPron) && (
        <span className="pron" lang="und" aria-label="Aussprache">
          {pron ? (
            `[${pron}]`
          ) : ipa ? (
            <span className="muted" title="Automatisch erzeugte Lautschrift (eSpeak NG) – noch nicht geprüft">/{ipa}/*</span>
          ) : (
            <span className="muted">[Aussprache fehlt]</span>
          )}
        </span>
      )}
      {d.pos && pos && <span className="muted small">{pos}</span>}
      {d.gender && gender && <span className="muted small">{gender}</span>}
      {d.cefr && <CefrBadge level={cefr} />}
      {d.gloss && gloss && <span className="gloss">{gloss}</span>}
    </span>
  );
}
