import { Fragment, type ReactNode } from "react";

/**
 * Text mit klickbaren Links – ohne innerHTML. Nur http(s)-Adressen werden verlinkt (kein javascript:,
 * data: o. Ä.); alles andere bleibt reiner Text, React escaped ihn. Links öffnen in neuem Tab ohne
 * Zugriff auf diese Seite (noopener) und ohne Referrer.
 */
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING = /[).,;:!?'"»“”]+$/;

export function safeHref(raw: string): string | null {
  const candidate = raw.startsWith("www.") ? `https://${raw}` : raw;
  try {
    const u = new URL(candidate);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch {
    return null;
  }
}

export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    let url = m[0];
    const trail = TRAILING.exec(url)?.[0] ?? "";
    if (trail) url = url.slice(0, -trail.length);
    const start = m.index!;
    const href = safeHref(url);
    if (!href) continue;
    if (start > last) out.push(<Fragment key={`t${last}`}>{text.slice(last, start)}</Fragment>);
    out.push(
      <a key={`a${start}`} href={href} target="_blank" rel="noopener noreferrer nofollow ugc">
        {url.length > 60 ? `${url.slice(0, 57)}…` : url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) out.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>);
  return out;
}

/** Nur Emojis (1–3)? Dann groß darstellen. */
export const isEmojiOnly = (text: string) => /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s){1,12}$/u.test(text) && !/^[\d#*\s]+$/.test(text);
