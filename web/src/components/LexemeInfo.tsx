import { Recordings } from "./Recordings";
import { useEffect, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { groupForms, RELATION_KINDS, RELATION_LABEL, type LangCode, type LexemeDetail, type RelationKind } from "@vochat/shared";
import { api } from "../api/client";
import { useSession } from "../session";
import type { CardRow } from "../local/collections";
import { addCardFromLexeme, hasCardWord } from "../lib/cards";
import { CefrBadge, Lemma } from "./ui";
import { IconPlus } from "./icons";

/** Vollansicht eines Eintrags: Bedeutungen, Übersetzungen, Beispielsätze, Kategorien. */
export function LexemeInfo({ lexemeId, lang }: { lexemeId: number; lang: LangCode }) {
  const { user } = useSession();
  const [detail, setDetail] = useState<LexemeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .lexeme(lexemeId, user.nativeLang)
      .then((d) => alive && setDetail(d))
      .catch(() => alive && setError("Details nicht verfügbar (offline?)"));
    return () => {
      alive = false;
    };
  }, [user.nativeLang, lexemeId]);

  if (error) return <div className="muted small">{error}</div>;
  if (!detail) return <div className="muted small">Lade Details …</div>;

  return (
    <div className="info">
      {(detail.romanization || detail.ipa) && (
        <div className="muted small">
          Aussprache: {[detail.romanization, detail.ipa ? `IPA ${detail.ipa}` : null].filter(Boolean).join(" · ")}
        </div>
      )}
      <Recordings lexemeId={detail.id} lemma={detail.lemma} />
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
      {detail.forms && detail.forms.length > 0 && <Forms forms={detail.forms} lang={lang} />}
      {detail.relations && detail.relations.length > 0 && <Relations relations={detail.relations} lang={lang} />}
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

/** Konjugation, Deklination, Steigerung – gruppiert, standardmäßig eingeklappt. */
function Forms({ forms, lang }: { forms: NonNullable<LexemeDetail["forms"]>; lang: LangCode }) {
  const groups = groupForms(forms, lang);
  return (
    <details className="forms">
      <summary>Formen <span className="muted small">({forms.length})</span></summary>
      <div className="form-groups">
        {groups.map((g) => (
          <section key={g.title} className="form-group">
            <h4>{g.title}</h4>
            <table>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.label || r.forms.join()}>
                    {r.label && <th scope="row">{r.label}</th>}
                    <td colSpan={r.label ? 1 : 2}>
                      <FormList forms={r.forms} lang={lang} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </details>
  );
}

/** Höchstens drei Formen je Zeile; der Rest (z. B. Imperativ mit angehängten Pronomen) zum Aufklappen. */
function FormList({ forms, lang }: { forms: string[]; lang: LangCode }) {
  const [all, setAll] = useState(false);
  const shown = all ? forms : forms.slice(0, 3);
  return (
    <>
      <Lemma lang={lang}>{shown.join(", ")}</Lemma>
      {forms.length > 3 && (
        <button type="button" className="link small more-forms" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? " weniger" : ` +${forms.length - 3} weitere`}
        </button>
      )}
    </>
  );
}

/** Synonyme, Gegenteile, verwandte Wörter … – mit „+ Lernen“, wenn das Ziel im Wörterbuch steht. */
function Relations({ relations, lang }: { relations: NonNullable<LexemeDetail["relations"]>; lang: LangCode }) {
  const { collections, user } = useSession();
  const cards = (useLiveQuery(() => collections.cards).data ?? []) as CardRow[];
  const [busy, setBusy] = useState<number | null>(null);
  const learn = async (id: number) => {
    setBusy(id);
    try {
      addCardFromLexeme(collections, await api.lexeme(id, user.nativeLang), lang, "relation");
    } finally {
      setBusy(null);
    }
  };
  const byKind = RELATION_KINDS.map((k) => [k, relations.filter((r) => r.kind === k)] as const).filter(([, list]) => list.length > 0);
  return (
    <div className="relations stack">
      {byKind.map(([kind, list]) => (
        <div key={kind} className="row relation-row">
          <span className="muted small relation-kind">{RELATION_LABEL[kind as RelationKind]}</span>
          {list.map((r) => {
            const have = hasCardWord(cards, lang, r.lemma, r.lexemeId);
            return (
              <span key={r.lemma} className={`chip relation ${have ? "have" : ""}`}>
                <Lemma lang={lang}>{r.lemma}</Lemma>
                {r.lexemeId && !have && (
                  <button type="button" className="chip-x" aria-label={`${r.lemma} lernen`} title="Lernen" disabled={busy === r.lexemeId} onClick={() => learn(r.lexemeId!)}>
                    <IconPlus size={13} />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
