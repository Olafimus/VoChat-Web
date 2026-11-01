import { useEffect, useState, type FormEvent } from "react";
import { LANGUAGES, LANG_CODES, type LangCode, type LexemeSummary } from "@vochat/shared";
import { api, ApiError, community, type CommunityRow } from "../api/client";
import { useSession } from "../session";
import { CefrBadge, Empty, Lemma } from "../components/ui";

type Tab = "pruefen" | "vorschlagen" | "meine" | "rollen";

const KIND_LABEL: Record<CommunityRow["kind"], string> = {
  lexeme: "Neues Wort",
  sense: "Bedeutung",
  example: "Beispielsatz",
  translation: "Übersetzung",
  retract: "Widerruf",
};

const STATUS_LABEL: Record<CommunityRow["status"], string> = {
  pending: "offen",
  verified: "verifiziert",
  rejected: "abgelehnt",
  revoked: "widerrufen",
};

/** Mitmachen: Beiträge vorschlagen, andere verifizieren oder falsifizieren, Rollen einsehen. */
export function CommunityPage() {
  const { token, user } = useSession();
  const [tab, setTab] = useState<Tab>("pruefen");
  if (!token) {
    return (
      <div className="card stack">
        <h2>Mitmachen</h2>
        <p className="muted">
          Für Beiträge und Abstimmungen brauchst du ein Konto. Lege es unter <b>Profil</b> an – deine lokalen Daten bleiben erhalten.
        </p>
      </div>
    );
  }
  return (
    <div className="stack">
      <div className="segmented four" role="tablist">
        <button className={tab === "pruefen" ? "on" : ""} onClick={() => setTab("pruefen")}>Prüfen</button>
        <button className={tab === "vorschlagen" ? "on" : ""} onClick={() => setTab("vorschlagen")}>Vorschlagen</button>
        <button className={tab === "meine" ? "on" : ""} onClick={() => setTab("meine")}>Meine</button>
        <button className={tab === "rollen" ? "on" : ""} onClick={() => setTab("rollen")}>Rollen</button>
      </div>
      {tab === "pruefen" && <ReviewQueue token={token} />}
      {tab === "vorschlagen" && <Suggest token={token} nativeLang={user.nativeLang} />}
      {tab === "meine" && <MyContributions token={token} />}
      {tab === "rollen" && <Roles token={token} />}
    </div>
  );
}

function ReviewQueue({ token }: { token: string }) {
  const [rows, setRows] = useState<CommunityRow[] | null>(null);
  const [lang, setLang] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    community
      .list(token, { status: "pending", lang: lang || undefined })
      .then((r) => {
        setRows(r);
        setError(null);
      })
      .catch(() => setError("Beiträge konnten nicht geladen werden."));

  useEffect(() => {
    setRows(null);
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, token]);

  const act = async (id: number, vote: "verify" | "reject") => {
    try {
      await community.vote(token, id, vote);
      await load();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 403 ? "Du kannst deinen eigenen Beitrag nicht bewerten." : "Abstimmen fehlgeschlagen.");
    }
  };

  return (
    <div className="stack">
      <div className="row">
        <label className="inline">
          Sprache
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="">alle</option>
            {LANG_CODES.map((l) => (
              <option key={l} value={l}>{LANGUAGES[l].name}</option>
            ))}
          </select>
        </label>
        <span className="muted small">Experten entscheiden sofort. Sonst entscheiden übereinstimmende Stimmen.</span>
      </div>
      {error && <div className="error">{error}</div>}
      {rows?.length === 0 && <Empty>Keine offenen Beiträge. Schau später wieder vorbei.</Empty>}
      <ul className="list">
        {rows?.map((r) => (
          <li key={r.id} className="card stack">
            <div className="row">
              <span className="badge subtle">{KIND_LABEL[r.kind]}</span>
              <span className="badge">{LANGUAGES[r.lang as LangCode]?.name ?? r.lang}</span>
              <span className="muted small">von {r.author}</span>
            </div>
            <ContributionBody row={r} />
            <div className="row">
              <button className="primary small-btn" onClick={() => act(r.id, "verify")}>✓ Richtig</button>
              <button className="danger small-btn" onClick={() => act(r.id, "reject")}>✗ Falsch</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContributionBody({ row }: { row: CommunityRow }) {
  const p = row.payload as Record<string, string | number | null>;
  const lang = row.lang as LangCode;
  switch (row.kind) {
    case "lexeme":
      return <div><Lemma lang={lang}>{String(p.lemma)}</Lemma> <span className="gloss">= {String(p.gloss)}</span> {p.cefr && <CefrBadge level={String(p.cefr)} />}</div>;
    case "sense":
      return <div>Bedeutung zu Lexem #{String(p.lexemeId)}: <b>{String(p.gloss)}</b></div>;
    case "example":
      return <div><Lemma lang={lang}>{String(p.text)}</Lemma>{p.translation && <div className="muted small">{String(p.translation)}</div>}</div>;
    case "translation":
      return <div>Lexem #{String(p.lexemeId)} → {String(p.targetLang)}: <b>{String(p.targetLemma)}</b></div>;
    case "retract":
      return <div>Widerruf von {String(p.target)} #{String(p.targetId)}: <i>{String(p.reason)}</i></div>;
  }
}

function Suggest({ token, nativeLang }: { token: string; nativeLang: LangCode }) {
  const [kind, setKind] = useState<CommunityRow["kind"]>("sense");
  const [lang, setLang] = useState<LangCode>("fa");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LexemeSummary[]>([]);
  const [target, setTarget] = useState<LexemeSummary | null>(null);
  const [text, setText] = useState({ lemma: "", pos: "", gloss: "", example: "", translation: "", targetLang: "de" as LangCode, targetLemma: "", reason: "" });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (kind === "lexeme") return;
    const t = setTimeout(() => {
      if (query.trim().length < 1) return setHits([]);
      api.search(lang, query, nativeLang).then(setHits).catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [query, lang, kind, nativeLang]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const base = { lexemeId: target?.id ?? 0 };
    const payloads: Record<CommunityRow["kind"], unknown> = {
      lexeme: { kind: "lexeme", lang, lemma: text.lemma, pos: text.pos, glossLang: nativeLang, gloss: text.gloss },
      sense: { kind: "sense", lexemeId: base.lexemeId, glossLang: nativeLang, gloss: text.gloss },
      example: { kind: "example", lexemeId: base.lexemeId, text: text.example, translation: text.translation || null, translationLang: text.translation ? nativeLang : null },
      translation: { kind: "translation", lexemeId: base.lexemeId, targetLang: text.targetLang, targetLemma: text.targetLemma },
      retract: { kind: "retract", target: "sense", targetId: base.lexemeId, reason: text.reason },
    };
    try {
      await community.submit(token, payloads[kind]);
      setMsg("Danke! Dein Vorschlag wartet auf Prüfung.");
      setText({ ...text, gloss: "", example: "", translation: "", targetLemma: "", reason: "", lemma: "", pos: "" });
    } catch (err) {
      setMsg(err instanceof ApiError && err.status === 429 ? "Du hast schon sehr viele offene Vorschläge." : "Der Vorschlag konnte nicht gespeichert werden.");
    }
  };

  const needsTarget = kind !== "lexeme";

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Vorschlagen</h2>
      <label>
        Was möchtest du ergänzen?
        <select value={kind} onChange={(e) => setKind(e.target.value as CommunityRow["kind"])}>
          {(Object.keys(KIND_LABEL) as CommunityRow["kind"][]).map((k) => (
            <option key={k} value={k}>{KIND_LABEL[k]}</option>
          ))}
        </select>
      </label>
      <label>
        Sprache
        <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)}>
          {LANG_CODES.filter((l) => l !== nativeLang).map((l) => (
            <option key={l} value={l}>{LANGUAGES[l].name}</option>
          ))}
        </select>
      </label>

      {needsTarget && kind !== "retract" && (
        <div className="stack">
          <label>
            Wort suchen
            <input value={query} onChange={(e) => { setQuery(e.target.value); setTarget(null); }} placeholder="Wort eintippen …" />
          </label>
          {!target && hits.map((h) => (
            <button key={h.id} type="button" className="lookup-pick" onClick={() => setTarget(h)}>
              <Lemma lang={lang}>{h.lemma}</Lemma> <span className="muted small">{h.gloss ?? ""}</span>
            </button>
          ))}
          {target && <div className="row">Ausgewählt: <Lemma lang={lang}>{target.lemma}</Lemma> <button type="button" className="small-btn" onClick={() => setTarget(null)}>ändern</button></div>}
        </div>
      )}

      {kind === "lexeme" && (
        <>
          <label>Wort<input required value={text.lemma} onChange={(e) => setText({ ...text, lemma: e.target.value })} dir={lang === "fa" ? "rtl" : "ltr"} /></label>
          <label>Wortart (optional)<input value={text.pos} onChange={(e) => setText({ ...text, pos: e.target.value })} placeholder="noun, verb …" /></label>
          <label>Bedeutung ({LANGUAGES[nativeLang].name})<input required value={text.gloss} onChange={(e) => setText({ ...text, gloss: e.target.value })} /></label>
        </>
      )}
      {kind === "sense" && <label>Weitere Bedeutung ({LANGUAGES[nativeLang].name})<input required disabled={!target} value={text.gloss} onChange={(e) => setText({ ...text, gloss: e.target.value })} /></label>}
      {kind === "example" && (
        <>
          <label>Beispielsatz<input required disabled={!target} value={text.example} onChange={(e) => setText({ ...text, example: e.target.value })} dir={lang === "fa" ? "rtl" : "ltr"} /></label>
          <label>Übersetzung (optional)<input disabled={!target} value={text.translation} onChange={(e) => setText({ ...text, translation: e.target.value })} /></label>
        </>
      )}
      {kind === "translation" && (
        <>
          <label>Zielsprache
            <select value={text.targetLang} onChange={(e) => setText({ ...text, targetLang: e.target.value as LangCode })}>
              {LANG_CODES.filter((l) => l !== lang).map((l) => <option key={l} value={l}>{LANGUAGES[l].name}</option>)}
            </select>
          </label>
          <label>Übersetzung<input required disabled={!target} value={text.targetLemma} onChange={(e) => setText({ ...text, targetLemma: e.target.value })} /></label>
        </>
      )}
      {kind === "retract" && (
        <>
          <label>Lexem-ID der falschen Angabe<input required type="number" value={target?.id ?? ""} onChange={(e) => setTarget({ id: Number(e.target.value), lemma: "", lang, pos: null, gender: null, cefr: null, frequencyRank: null, gloss: null })} /></label>
          <label>Begründung<input required minLength={3} value={text.reason} onChange={(e) => setText({ ...text, reason: e.target.value })} /></label>
        </>
      )}

      {msg && <div className="muted small" role="status">{msg}</div>}
      <button className="primary" disabled={needsTarget && kind !== "retract" && !target}>Vorschlag abschicken</button>
      <div className="muted small">Vorschläge werden erst nach Prüfung im Wörterbuch sichtbar.</div>
    </form>
  );
}

function MyContributions({ token }: { token: string }) {
  const [rows, setRows] = useState<CommunityRow[] | null>(null);
  useEffect(() => {
    community.list(token, { mine: true }).then(setRows).catch(() => setRows([]));
  }, [token]);
  if (rows === null) return <div className="muted">Lade …</div>;
  if (rows.length === 0) return <Empty>Du hast noch nichts vorgeschlagen.</Empty>;
  return (
    <ul className="list">
      {rows.map((r) => (
        <li key={r.id} className="card row-card">
          <div className="row">
            <span className="badge subtle">{KIND_LABEL[r.kind]}</span>
            <span className="badge">{LANGUAGES[r.lang as LangCode]?.name ?? r.lang}</span>
            <span className={`badge status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
          </div>
          <ContributionBody row={r} />
          {r.decisionReason && <div className="muted small">{r.decisionReason}</div>}
        </li>
      ))}
    </ul>
  );
}

function Roles({ token }: { token: string }) {
  const [roles, setRoles] = useState<{ role: string; lang: string }[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"expert" | "admin">("expert");
  const [lang, setLang] = useState<LangCode>("fa");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    community.me(token).then((m) => {
      setRoles(m.roles);
      setCounts(m.contributions);
    });
  }, [token]);

  const isAdmin = roles?.some((r) => r.role === "admin") ?? false;
  const grant = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await community.grant(token, email, role, role === "expert" ? lang : null);
      setMsg(`Rolle an ${email} vergeben.`);
      setEmail("");
    } catch (err) {
      setMsg(err instanceof ApiError && err.status === 404 ? "Diese E-Mail ist nicht registriert." : "Vergeben fehlgeschlagen.");
    }
  };

  return (
    <div className="stack">
      <div className="card stack">
        <h2>Deine Rollen</h2>
        {roles === null ? <div className="muted">Lade …</div> : roles.length === 0 ? (
          <div className="muted">Du bist Mitglied der Community. Experten werden für jede Sprache von Admins ernannt.</div>
        ) : (
          <div className="chips">
            {roles.map((r) => (
              <span key={`${r.role}-${r.lang}`} className="badge">
                {r.role === "admin" ? "Admin" : `Experte ${LANGUAGES[r.lang as LangCode]?.name ?? r.lang}`}
              </span>
            ))}
          </div>
        )}
        <div className="muted small">
          Deine Beiträge: {Object.entries(counts).map(([k, v]) => `${STATUS_LABEL[k as CommunityRow["status"]] ?? k} ${v}`).join(" · ") || "keine"}
        </div>
      </div>
      {isAdmin && (
        <form className="card stack" onSubmit={grant}>
          <h2>Rolle vergeben</h2>
          <label>E-Mail<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Rolle
            <select value={role} onChange={(e) => setRole(e.target.value as "expert" | "admin")}>
              <option value="expert">Experte</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {role === "expert" && (
            <label>Sprache
              <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)}>
                {LANG_CODES.map((l) => <option key={l} value={l}>{LANGUAGES[l].name}</option>)}
              </select>
            </label>
          )}
          {msg && <div className="muted small" role="status">{msg}</div>}
          <button className="primary">Vergeben</button>
        </form>
      )}
    </div>
  );
}
