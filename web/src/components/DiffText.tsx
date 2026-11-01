import { diffWords } from "@vochat/shared";

/** Zeigt Unterschiede wortgenau: entfernt durchgestrichen, neu hervorgehoben. */
export function DiffText({ before, after }: { before: string; after: string }) {
  return (
    <span className="diff">
      {diffWords(before, after).map((p, i) =>
        p.type === "same" ? (
          <span key={i}>{p.text}</span>
        ) : p.type === "del" ? (
          <del key={i} aria-label={`entfernt: ${p.text}`}>{p.text}</del>
        ) : (
          <ins key={i} aria-label={`neu: ${p.text}`}>{p.text}</ins>
        ),
      )}
    </span>
  );
}
