import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { coverage, LANGUAGES, MEDIA_TYPES, type CatalogCollection, type Cefr, type LangCode } from "@vochat/shared";
import { api, ApiError } from "../api/client";
import { extract } from "../api/client";
import { useSession, useSyncStatus } from "../session";
import { useActiveLang } from "../lib/lang";
import { addCard, hasCardWord } from "../lib/cards";
import { newMediaCollection, parseItemLines } from "../lib/collections";
import type { CardRow, MediaCollectionRow } from "../local/collections";
import { CefrBadge, Empty, Lemma } from "../components/ui";
import { WordView } from "../components/WordView";

type Tab = "empfohlen" | "medien" | "meine";

const MEDIA_LABEL: Record<(typeof MEDIA_TYPES)[number], string> = {
  book: "Buch",
  song: "Lied",
  film: "Film",
  series: "Serie",
  other: "Sonstiges",
};

/** Lernpfade: empfohlene Pfade, geteilte Medien-Wortschätze und eigene Sammlungen – mit Abgleich der fehlenden Wörter. */
export function PathsPage() {
  const [tab, setTab] = useState<Tab>("empfohlen");
  return (
    <div className="stack">
      <div className="segmented three" role="tablist">
        <button className={tab === "empfohlen" ? "on" : ""} onClick={() => setTab("empfohlen")}>Empfohlen</button>
        <button className={tab === "medien" ? "on" : ""} onClick={() => setTab("medien")}>Medien</button>
        <button className={tab === "meine" ? "on" : ""} onClick={() => setTab("meine")}>Meine</button>
      </div>
      {tab === "empfohlen" && <RecommendedPaths />}
      {tab === "medien" && <SharedMedia />}
      {tab === "meine" && <MyCollections />}
    </div>
  );
}

/* ---------- Empfohlene Lernpfade ---------- */

function RecommendedPaths() {
  const { user, collections, token } = useSession();
  const [lang, , learning] = useActiveLang();
  const [paths, setPaths] = useState<CatalogCollection[] | null>(null);
  const [open, setOpen] = useState<CatalogCollection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];
  const status = useSyncStatus();

  useEffect(() => {
    setPaths(null);
    setOpen(null);
    api.paths(lang).then(setPaths).catch(() => setError("Lernpfade konnten nicht geladen werden."));
  }, [lang]);

  if (learning.length === 0) return <Empty>Wähle unter Profil eine Lernsprache.</Empty>;
  if (open) return <PathDetail id={open.id} lang={lang} native={user.nativeLang} onBack={() => setOpen(null)} cards={cards} />;

  return (
    <div className="stack">
      <div className="muted small">Lernsprache: <span className="badge">{LANGUAGES[lang].name}</span></div>
      {!status.online && <div className="warn-box">Offline – Lernpfade werden erst geladen, wenn du wieder online bist.</div>}
      {error && <div className="error">{error}</div>}
      {paths === null && !error && <div className="muted">Lade …</div>}
      <ul className="list">
        {paths?.map((p) => (
          <li key={p.id} className="card row-card">
            <button className="link" onClick={() => api.pathDetail(p.id, user.nativeLang).then(setOpen).catch(() => setError("Pfad nicht verfügbar."))}>
              {p.title}
            </button>
            <div className="muted small">{p.description}</div>
            {p.level && <CefrBadge level={p.level} />}
          </li>
        ))}
      </ul>
      {token === null && <div className="muted small">Tipp: Mit Konto kannst du Pfade später auch auf anderen Geräten nutzen.</div>}
      {paths?.length === 0 && <Empty>Für diese Sprache gibt es noch keine Lernpfade.</Empty>}
    </div>
  );
}

function PathDetail({ id, lang, native, onBack, cards }: { id: string; lang: LangCode; native: LangCode; onBack: () => void; cards: CardRow[] }) {
  const { collections, user } = useSession();
  const [detail, setDetail] = useState<CatalogCollection | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.pathDetail(id, native).then(setDetail).catch(() => setDetail(null));
  }, [id, native]);

  if (!detail?.items) return <div className="muted">Lade …</div>;
  const detailItems = detail.items;
  const cov = coverage(detailItems, cards);
  const missing = cov.missing;

  const copyToOwn = () => {
    const row = newMediaCollection({
      kind: "path",
      mediaType: null,
      title: detail.title,
      description: detail.description,
      lang,
      level: detail.level,
      visibility: "private",
      ownerName: user.name,
      items: detailItems.map((i) => ({ lemma: i.lemma, lang: i.lang, lexemeId: i.lexemeId, gloss: i.gloss, pronunciation: i.pronunciation ?? null, cefr: i.cefr })),
    });
    void collections.collections.insert(row);
    setCopied(true);
  };

  return (
    <div className="stack">
      <button onClick={onBack}>← Zurück</button>
      <div className="card stack">
        <h2>{detail.title}</h2>
        <p className="muted">{detail.description}</p>
        <Coverage ratio={cov.ratio} known={cov.known} learning={cov.learning} total={cov.total} />
        <div className="row">
          <button className="primary" onClick={copyToOwn} disabled={copied}>{copied ? "Übernommen ✓" : "Als eigene Liste übernehmen"}</button>
          <button onClick={() => missing.forEach((i) => addCardOf(collections, i))} disabled={missing.length === 0}>
            Alle fehlenden lernen ({missing.length})
          </button>
        </div>
      </div>
      <ItemList items={detailItems} lang={lang} cards={cards} />
    </div>
  );
}

/* ---------- Medien (geteilt) ---------- */

function SharedMedia() {
  const { user, collections, token } = useSession();
  const [lang] = useActiveLang();
  const status = useSyncStatus();
  const [type, setType] = useState<string>("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"new" | "rating">("rating");
  const [allLangs, setAllLangs] = useState(false);
  const [list, setList] = useState<CatalogCollection[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .publicCollections({ kind: "media", mediaType: type, q, sort, lang: allLangs ? undefined : lang }, token)
        .then((r) => {
          setList(r);
          setError(null);
        })
        .catch((err) => setError(err instanceof ApiError && err.status === 0 ? "Offline – geteilte Medien brauchen eine Verbindung." : "Laden fehlgeschlagen."));
    }, 250);
    return () => clearTimeout(t);
  }, [type, q, sort, token, lang, allLangs]);

  if (open) return <MediaDetail id={open} cards={cards} onBack={() => setOpen(null)} />;

  return (
    <div className="stack">
      <div className="toolbar">
        <input type="search" placeholder="Titel suchen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Medien suchen" />
        <select value={sort} onChange={(e) => setSort(e.target.value as "new" | "rating")} aria-label="Sortierung">
          <option value="rating">Beste Bewertung</option>
          <option value="new">Neueste</option>
        </select>
      </div>
      <div className="chips">
        <button className={`chip ${type === "" ? "on" : ""}`} onClick={() => setType("")}>Alle</button>
        {MEDIA_TYPES.map((t) => (
          <button key={t} className={`chip ${type === t ? "on" : ""}`} onClick={() => setType(t)}>{MEDIA_LABEL[t]}</button>
        ))}
      </div>
      {!status.online && <div className="warn-box">Offline – geteilte Medien sind gerade nicht erreichbar.</div>}
      {error && <div className="error">{error}</div>}
      {list && list.length === 0 && !error && <Empty>Noch keine geteilten Medien. Du kannst deine eigene Sammlung unter „Meine“ teilen.</Empty>}
      <ul className="list">
        {list?.map((m) => (
          <li key={m.id} className="card row-card">
            <div className="row">
              <button className="link" onClick={() => setOpen(m.id)}>{m.title}</button>
              {m.mediaType && <span className="badge subtle">{MEDIA_LABEL[m.mediaType as keyof typeof MEDIA_LABEL]}</span>}
              <span className="badge">{LANGUAGES[m.lang].name}</span>
              <span className="spacer" />
              <Difficulty value={m.rating.average} count={m.rating.count} />
            </div>
            <div className="muted small">{m.itemCount} Wörter · von {m.ownerName}</div>
          </li>
        ))}
      </ul>
      <label className="inline small">
        <input type="checkbox" checked={allLangs} onChange={(e) => setAllLangs(e.target.checked)} />
        Alle Sprachen zeigen (sonst nur {LANGUAGES[lang].name})
      </label>
      {user.learnLangs.length === 0 && <div className="muted small">Tipp: Lernsprache im Profil wählen.</div>}
    </div>
  );
}

function MediaDetail({ id, cards, onBack }: { id: string; cards: CardRow[]; onBack: () => void }) {
  const { collections, user, token } = useSession();
  const [detail, setDetail] = useState<(CatalogCollection & { myRating: number | null }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api
      .publicCollection(id, token)
      .then(setDetail)
      .catch(() => setError("Medium nicht verfügbar."));

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  if (error) return <div className="error">{error}</div>;
  if (!detail?.items) return <div className="muted">Lade …</div>;
  const detailItems = detail.items;
  const cov = coverage(detailItems, cards);
  const missing = cov.missing;

  const copyToOwn = () => {
    const row = newMediaCollection({
      kind: "media",
      mediaType: detail.mediaType as MediaCollectionRow["mediaType"],
      title: detail.title,
      description: detail.description,
      lang: detail.lang,
      level: detail.level,
      visibility: "private",
      ownerName: user.name,
      items: detailItems.map((i) => ({ lemma: i.lemma, lang: i.lang, lexemeId: i.lexemeId, gloss: i.gloss, pronunciation: i.pronunciation ?? null, cefr: i.cefr })),
    });
    void collections.collections.insert(row);
  };

  const rate = async (difficulty: number) => {
    if (!token) return;
    setSaving(true);
    try {
      await api.rate(token, id, difficulty);
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="stack">
      <button onClick={onBack}>← Zurück</button>
      <div className="card stack">
        <div className="row">
          <h2>{detail.title}</h2>
          {detail.mediaType && <span className="badge subtle">{MEDIA_LABEL[detail.mediaType as keyof typeof MEDIA_LABEL]}</span>}
        </div>
        <p className="muted">{detail.description}</p>
        <div className="muted small">von {detail.ownerName} · {detail.itemCount} Wörter</div>
        <Coverage ratio={cov.ratio} known={cov.known} learning={cov.learning} total={cov.total} />
        <div className="row">
          <button onClick={() => missing.forEach((i) => addCardOf(collections, i))} disabled={missing.length === 0} className="primary">
            Fehlende Wörter lernen ({missing.length})
          </button>
          <button onClick={copyToOwn}>Als eigene Sammlung übernehmen</button>
        </div>
        <div className="stack">
          <div className="row">
            <span className="muted">Schwierigkeit:</span>
            <Difficulty value={detail.rating.average} count={detail.rating.count} />
          </div>
          {token ? (
            <div className="row" role="radiogroup" aria-label="Schwierigkeit bewerten">
              {[1, 2, 3, 4, 5].map((d) => (
                <button key={d} className={`star ${detail.myRating && d <= detail.myRating ? "on" : ""}`} disabled={saving} onClick={() => rate(d)} aria-label={`${d} von 5`}>
                  ★
                </button>
              ))}
              <span className="muted small">{detail.myRating ? `Deine Bewertung: ${detail.myRating}` : "Bewerte die Schwierigkeit"}</span>
            </div>
          ) : (
            <div className="muted small">Zum Bewerten bitte unter Profil ein Konto anlegen.</div>
          )}
        </div>
      </div>
      <ItemList items={detailItems} lang={detail.lang} cards={cards} />
    </div>
  );
}

function addCardOf(collections: Parameters<typeof addCard>[0], i: { lang: string; lemma: string; lexemeId?: number | null; gloss: string | null; pronunciation?: string | null; cefr: string | null }) {
  addCard(collections, { lang: i.lang as LangCode, lemma: i.lemma, lexemeId: i.lexemeId ?? null, gloss: i.gloss, pronunciation: i.pronunciation ?? null, cefr: (i.cefr as Cefr | null) ?? null });
}

/* ---------- Meine Sammlungen ---------- */

function MyCollections() {
  const { collections, token, engine } = useSession();
  const [lang] = useActiveLang();
  const cards = (useLiveQuery((q) => collections.cards).data ?? []) as CardRow[];
  const mine = (useLiveQuery((q) => collections.collections).data ?? []) as MediaCollectionRow[];
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const visible = mine.filter((c) => !c.deleted).sort((a, b) => b.createdAt - a.createdAt);
  const open = visible.find((c) => c.id === openId);

  if (creating) return <CreateCollection onDone={() => setCreating(false)} defaultLang={lang} />;
  if (open) return <OwnDetail c={open} cards={cards} onBack={() => setOpenId(null)} engine={engine} token={token} />;

  return (
    <div className="stack">
      <div className="row">
        <span className="muted small">{visible.length} eigene Sammlungen{token ? "" : " (lokal, ohne Konto)"}</span>
        <span className="spacer" />
        <button className="primary" onClick={() => setCreating(true)}>+ Neue Sammlung</button>
      </div>
      {visible.length === 0 && <Empty>Lege eine Sammlung für ein Lied, Buch oder einen Film an – oder einen eigenen Lernpfad.</Empty>}
      <ul className="list">
        {visible.map((c) => {
          const cov = coverage(c.items, cards);
          return (
            <li key={c.id} className="card row-card">
              <div className="row">
                <button className="link" onClick={() => setOpenId(c.id)}>{c.title}</button>
                <span className="badge subtle">{c.kind === "path" ? "Lernpfad" : MEDIA_LABEL[(c.mediaType ?? "other") as keyof typeof MEDIA_LABEL]}</span>
                {c.visibility === "public" && <span className="badge">geteilt</span>}
                <span className="spacer" />
                <span className="muted small">{Math.round(cov.ratio * 100)} % bekannt</span>
              </div>
            </li>
          );
        })}
      </ul>
      {!token && visible.some((c) => c.visibility === "public") && (
        <div className="muted small">Geteilte Sammlungen werden erst mit Konto veröffentlicht.</div>
      )}
    </div>
  );
}

function CreateCollection({ onDone, defaultLang }: { onDone: () => void; defaultLang: LangCode }) {
  const { collections, user, token } = useSession();
  const [kind, setKind] = useState<"path" | "media">("media");
  const [mediaType, setMediaType] = useState<(typeof MEDIA_TYPES)[number]>("song");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lang, setLang] = useState<LangCode>(defaultLang);
  const [level, setLevel] = useState<string>("");
  const [text, setText] = useState("");
  const [share, setShare] = useState(false);
  const items = useMemo(() => parseItemLines(text, lang), [text, lang]);
  const [extractInfo, setExtractInfo] = useState<string | null>(null);

  /** Ersetzt den Text durch die im Wörterbuch gefundenen Wörter (mit Bedeutung), unbekannte bleiben als Hinweis. */
  const [source, setSource] = useState("");

  /**
   * Text (z. B. Liedtext, Buchkapitel) einmalig auswerten: alle vorkommenden Wörter werden als
   * Wortliste übernommen, der Text selbst wird verworfen und nie gespeichert. Wörter ohne
   * Wörterbucheintrag bleiben in der Liste und verknüpfen sich später automatisch.
   */
  const extractFromSource = async () => {
    try {
      const { matches, unknown } = await extract(lang, source, user.nativeLang);
      const lines = [
        ...matches.map((m) => {
          const pron = m.romanization ? ` [${m.romanization}]` : "";
          return m.gloss ? `${m.lemma}${pron} = ${m.gloss}` : `${m.lemma}${pron}`;
        }),
        ...unknown,
      ];
      setText((prev) => [prev.trim(), ...lines].filter(Boolean).join("\n"));
      setSource("");
      setExtractInfo(
        `${matches.length + unknown.length} Wörter übernommen: ${matches.length} aus dem Wörterbuch` +
          (unknown.length ? `, ${unknown.length} noch ohne Eintrag (werden verknüpft, sobald es sie gibt)` : "") +
          ". Der Text selbst wurde nicht gespeichert.",
      );
    } catch {
      setExtractInfo("Auswertung fehlgeschlagen (offline?).");
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || items.length === 0) return;
    const row = newMediaCollection({
      kind,
      mediaType: kind === "media" ? mediaType : null,
      title: title.trim(),
      description: description.trim(),
      lang,
      level: level || null,
      visibility: share ? "public" : "private",
      ownerName: user.name,
      items,
    });
    void collections.collections.insert(row);
    onDone();
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>Neue Sammlung</h2>
      <div className="segmented">
        <button type="button" className={kind === "media" ? "on" : ""} onClick={() => setKind("media")}>Medium</button>
        <button type="button" className={kind === "path" ? "on" : ""} onClick={() => setKind("path")}>Lernpfad</button>
      </div>
      {kind === "media" && (
        <label>
          Art
          <select value={mediaType} onChange={(e) => setMediaType(e.target.value as (typeof MEDIA_TYPES)[number])}>
            {MEDIA_TYPES.map((t) => (
              <option key={t} value={t}>{MEDIA_LABEL[t]}</option>
            ))}
          </select>
        </label>
      )}
      <label>
        Titel
        <input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
      </label>
      <div className="row">
        <label style={{ flex: 1 }}>
          Sprache
          <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)}>
            {Object.values(LANGUAGES).map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </label>
        <label style={{ flex: 1 }}>
          Niveau (optional)
          <select value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">–</option>
            {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Beschreibung
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={2} />
      </label>
      <label>
        Text auswerten (optional, z. B. ein Liedtext, den du besitzt)
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          rows={5}
          placeholder="Text einfügen – es werden nur die vorkommenden Wörter übernommen, der Text wird nicht gespeichert."
          dir={lang === "fa" ? "rtl" : "ltr"}
        />
      </label>
      <div className="row">
        <button type="button" onClick={extractFromSource} disabled={!source.trim()}>
          Wörter aus Text übernehmen
        </button>
      </div>
      <label>
        Wortliste (eine Zeile pro Wort, optional „wort [aussprache] = bedeutung“)
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={"Haus = house\nآب [āb] = Wasser\nHund"} />
      </label>
      <div className="muted small">{items.length} Wörter in der Liste</div>
      {extractInfo && <div className="muted small" role="status">{extractInfo}</div>}
      <label className="inline">
        <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} disabled={!token} />
        Mit anderen teilen {token ? "" : "(Konto nötig)"}
      </label>
      <div className="row">
        <button className="primary" disabled={!title.trim() || items.length === 0}>Speichern</button>
        <button type="button" onClick={onDone}>Abbrechen</button>
      </div>
    </form>
  );
}

function OwnDetail({ c, cards, onBack, engine, token }: { c: MediaCollectionRow; cards: CardRow[]; onBack: () => void; engine: { getStatus: () => { enabled: boolean } }; token: string | null }) {
  const { collections } = useSession();
  const cov = coverage(c.items, cards);
  const missing = cov.missing;
  const remove = () => {
    collections.collections.update(c.id, (d) => {
      d.deleted = true;
      d.updatedAt = Date.now();
    });
    onBack();
  };
  const toggleShare = () => {
    collections.collections.update(c.id, (d) => {
      d.visibility = d.visibility === "public" ? "private" : "public";
      d.updatedAt = Date.now();
    });
  };
  return (
    <div className="stack">
      <button onClick={onBack}>← Zurück</button>
      <div className="card stack">
        <h2>{c.title}</h2>
        {c.description && <p className="muted">{c.description}</p>}
        <Coverage ratio={cov.ratio} known={cov.known} learning={cov.learning} total={cov.total} />
        <div className="row">
          <button className="primary" disabled={missing.length === 0} onClick={() => missing.forEach((i) => addCardOf(collections, i))}>
            Fehlende Wörter lernen ({missing.length})
          </button>
          <button onClick={toggleShare} disabled={!token || engine.getStatus().enabled === false}>
            {c.visibility === "public" ? "Nicht mehr teilen" : "Teilen"}
          </button>
          <span className="spacer" />
          <button className="danger" onClick={remove}>Löschen</button>
        </div>
        {!token && <div className="muted small">Teilen ist mit Konto möglich.</div>}
      </div>
      <ItemList items={c.items} lang={c.lang as LangCode} cards={cards} />
    </div>
  );
}

/* ---------- Gemeinsame Bausteine ---------- */

function Coverage({ ratio, known, learning, total }: { ratio: number; known: number; learning: number; total: number }) {
  const pct = Math.round(ratio * 100);
  return (
    <div className="coverage" aria-label={`${pct} Prozent bekannt`}>
      <div className="bar"><span style={{ width: `${pct}%` }} /></div>
      <div className="small muted">
        {pct} % bekannt · {known} von {total} Wörtern · {learning} in Arbeit · {total - known - learning} fehlen
      </div>
    </div>
  );
}

function ItemList({ items, lang, cards }: { items: { lemma: string; lang: string; gloss: string | null; pronunciation?: string | null; cefr: string | null; lexemeId?: number | null | undefined }[]; lang: LangCode; cards: CardRow[] }) {
  const { collections } = useSession();
  return (
    <ul className="list">
      {items.map((i, idx) => {
        const known = hasCardWord(cards, i.lang, i.lemma, i.lexemeId);
        const card = cards.find((c) => !c.deleted && c.lang === i.lang && c.lemma.toLocaleLowerCase("de") === i.lemma.toLocaleLowerCase("de"));
        return (
          <li key={`${i.lemma}-${idx}`} className="row card-line">
            <WordView lexemeId={i.lexemeId} lemma={i.lemma} lang={lang} pronunciation={i.pronunciation} gloss={i.gloss} cefr={i.cefr} />
            <span className="spacer" />
            {card?.status === "review" || card?.status === "mastered" ? (
              <span className="badge">bekannt</span>
            ) : known ? (
              <span className="badge subtle">in Arbeit</span>
            ) : (
              <button className="small-btn" onClick={() => addCardOf(collections, i)}>+ Lernen</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Difficulty({ value, count }: { value: number | null; count: number }) {
  if (value === null) return <span className="muted small">noch keine Bewertung</span>;
  return (
    <span className="difficulty" title={`${count} Bewertungen`}>
      {[1, 2, 3, 4, 5].map((d) => (
        <span key={d} className={d <= Math.round(value) ? "on" : ""}>★</span>
      ))}
      <span className="muted small"> {value.toFixed(1)} · {count}</span>
    </span>
  );
}
