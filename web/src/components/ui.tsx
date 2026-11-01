import type { ReactNode } from "react";
import { LANGUAGES, type LangCode } from "@vochat/shared";

export function LangBadge({ lang }: { lang: LangCode }) {
  return <span className="badge">{LANGUAGES[lang].name}</span>;
}

export function CefrBadge({ level }: { level: string | null | undefined }) {
  if (!level) return null;
  return <span className={`badge cefr cefr-${level[0]}`}>{level}</span>;
}

/** Text in der Sprache der Lemma: Persisch wird rechts-nach-links dargestellt. */
export function Lemma({ lang, children }: { lang: LangCode; children: ReactNode }) {
  return (
    <span className="lemma" lang={lang} dir={LANGUAGES[lang].dir}>
      {children}
    </span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty muted">{children}</div>;
}
