import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "@tanstack/react-db";
import {
  GLYPH_LANGS,
  LANGUAGES,
  glyphCounts,
  glyphStatus,
  planGlyphSession,
  type GlyphProgress,
  type GlyphScript,
  type GlyphSkill,
  type LangCode,
  type Strictness,
} from "@vochat/shared";
import { useSession } from "../session";
import { useActiveLang } from "../lib/lang";
import { prefs } from "../lib/prefs";
import { formatDays } from "../lib/learning";
import { SCRIPT_LABEL, categoriesFor, resetGlyph, useGlyphIndex, useGlyphProgress, useGlyphStrokes, type GlyphCategory, type GlyphInfo } from "../lib/glyphs";
import type { CardRow, GlyphRow } from "../local/collections";
import { PageHeader } from "../components/PageHeader";
import { Empty } from "../components/ui";
import { GlyphAnimation } from "../components/glyphs/GlyphAnimation";
import { GlyphFacts, GlyphSession, MODE_INFO, type GlyphMode, type SessionItem } from "../components/glyphs/GlyphSession";
import { IconClose, IconLanguages, IconSettings } from "../components/icons";

interface GlyphSettings {
  strictness: Strictness;
  blockSize: number;
  newPerBlock: number;
}
const SETTINGS_KEY = "vochat.glyphs.settings";
const DEFAULTS: GlyphSettings = { strictness: "normal", blockSize: 15, newPerBlock: 5 };
const STRICTNESS_LABEL: Record<Strictness, string> = { relaxed: "Locker", normal: "Normal", strict: "Streng" };
const STATUS_LABEL = { new: "neu", learning: "lernend", review: "wiederholen", mastered: "sitzt" } as const;

function readSettings(): GlyphSettings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(prefs.get(SETTINGS_KEY) ?? "{}") as Partial<GlyphSettings>) };
  } catch {
    return DEFAULTS;
  }
}

const skillOf = (mode: GlyphMode): GlyphSkill => (mode === "recognize" ? "read" : "write");

/**
 * Zeichen lernen: Hiragana, Katakana und Kanji nach Kategorien (JLPT, Häufigkeit, Schuljahr, Kana-Reihen).
 * Drei Formate – Erkennen, Nachzeichnen, Masterclass (aus dem Gedächtnis, Strichreihenfolge zählt).
 */
export function GlyphsPage() {
  const [activeLang] = useActiveLang();
  const [params, setParams] = useSearchParams();
  const langs = Object.keys(GLYPH_LANGS) as LangCode[];
  const lang: LangCode = langs.includes(activeLang) ? activeLang : langs[0]!;
  const scripts = GLYPH_LANGS[lang]!;
  const script = (scripts.includes(params.get("script") as GlyphScript) ? params.get("script") : prefs.get("vochat.glyphs.script") ?? scripts[0]) as GlyphScript;
  const categories = useMemo(() => categoriesFor(script), [script]);
  const catId = params.get("cat") ?? prefs.get(`vochat.glyphs.cat.${script}`) ?? categories[0]!.id;
  const category = categories.find((c) => c.id === catId) ?? categories[0]!;

  const { glyphs, sources, error } = useGlyphIndex(lang);
  const progress = useGlyphProgress(lang);
  const [settings, setSettingsState] = useState(readSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState<GlyphSkill>("write");
  const [detail, setDetail] = useState<GlyphInfo | null>(null);
  const [session, setSession] = useState<{ mode: GlyphMode; items: SessionItem[]; key: number } | null>(null);

  const setSettings = (patch: Partial<GlyphSettings>) => {
    const next = { ...settings, ...patch };
    prefs.set(SETTINGS_KEY, JSON.stringify(next));
    setSettingsState(next);
  };
  const choose = (patch: { script?: GlyphScript; cat?: string }) => {
    const next = new URLSearchParams(params);
    if (patch.script) {
      prefs.set("vochat.glyphs.script", patch.script);
      next.set("script", patch.script);
      next.delete("cat");
    }
    if (patch.cat) {
      prefs.set(`vochat.glyphs.cat.${patch.script ?? script}`, patch.cat);
      next.set("cat", patch.cat);
    }
    setParams(next, { replace: true });
  };

  const inCategory = useMemo(() => (glyphs ? category.pick(glyphs) : []), [glyphs, category]);
  const byChar = useMemo(() => new Map((glyphs ?? []).map((g) => [g.c, g])), [glyphs]);
  const progressMap = progress as unknown as Map<string, GlyphProgress>;

  // Detail per Deep-Link (?c=日)
  useEffect(() => {
    const c = params.get("c");
    if (c && byChar.has(c)) setDetail(byChar.get(c)!);
  }, [params, byChar]);

  const start = (mode: GlyphMode, only?: GlyphInfo) => {
    let items: SessionItem[];
    if (only) {
      items = [{ glyph: only, kind: progress.get(only.c)?.[skillOf(mode)] ? "review" : "new" }];
    } else if (mode === "trace") {
      // Nachzeichnen: Zeichen, die in der Masterclass noch nicht sitzen, in Reihenfolge
      const open = inCategory.filter((g) => glyphStatus(progress.get(g.c)?.write) !== "mastered");
      items = (open.length ? open : inCategory).slice(0, settings.blockSize).map((g) => ({ glyph: g, kind: progress.get(g.c)?.write ? "review" : "new" }));
    } else {
      const plan = planGlyphSession({
        candidates: inCategory.map((g) => g.c),
        progress: progressMap,
        skill: skillOf(mode),
        now: Date.now(),
        newLimit: settings.newPerBlock,
        size: settings.blockSize,
      });
      items = plan.map((p) => ({ glyph: byChar.get(p.char)!, kind: p.kind })).filter((i) => i.glyph);
    }
    setDetail(null);
    setSession({ mode, items, key: Date.now() });
  };

  const header = (
    <PageHeader
      icon={<IconLanguages size={22} />}
      title="Zeichen"
      subtitle={`${LANGUAGES[lang].name}: ${scripts.map((s) => SCRIPT_LABEL[s]).join(", ")} – lesen und schreiben`}
      tone="qt-coral"
      actions={
        <button className="small-btn" onClick={() => setShowSettings((v) => !v)} aria-expanded={showSettings} title="Einstellungen">
          <IconSettings size={16} aria-hidden /> <span className="hide-sm">Einstellungen</span>
        </button>
      }
    />
  );

  if (session && glyphs) {
    return (
      <div className="glyphs-page stack">
        <GlyphSession
          key={session.key}
          lang={lang}
          mode={session.mode}
          items={session.items}
          pool={glyphs}
          strictness={settings.strictness}
          onExit={() => setSession(null)}
        />
      </div>
    );
  }

  const now = Date.now();
  const readCounts = glyphCounts(inCategory.map((g) => g.c), progressMap, "read", now);
  const writeCounts = glyphCounts(inCategory.map((g) => g.c), progressMap, "write", now);
  const groups = [...new Set(categories.map((c) => c.group))];

  return (
    <div className="glyphs-page stack">
      {header}
      {lang !== activeLang && (
        <p className="muted small">
          Zeichen-Lernen gibt es bisher für {langs.map((l) => LANGUAGES[l].name).join(", ")}. Deine aktive Lernsprache ist {LANGUAGES[activeLang].name}.
        </p>
      )}

      {showSettings && (
        <div className="card stack glyph-settings">
          <div>
            <div className="small muted">Strenge beim Schreiben</div>
            <div className="segmented three">
              {(["relaxed", "normal", "strict"] as Strictness[]).map((s) => (
                <button key={s} className={settings.strictness === s ? "on" : ""} onClick={() => setSettings({ strictness: s })}>
                  {STRICTNESS_LABEL[s]}
                </button>
              ))}
            </div>
            <p className="muted small">
              Wie genau Form und Lage eines Strichs passen müssen. Reihenfolge und Zugrichtung zählen in der Masterclass immer.
            </p>
          </div>
          <label className="row">
            <span className="grow">Zeichen je Block</span>
            <input type="number" min={5} max={60} value={settings.blockSize} onChange={(e) => setSettings({ blockSize: Math.max(5, Math.min(60, Number(e.target.value) || 15)) })} />
          </label>
          <label className="row">
            <span className="grow">Neue Zeichen je Block</span>
            <input type="number" min={0} max={30} value={settings.newPerBlock} onChange={(e) => setSettings({ newPerBlock: Math.max(0, Math.min(30, Number(e.target.value) || 0)) })} />
          </label>
        </div>
      )}

      <div className={`segmented ${scripts.length === 3 ? "three" : ""}`} role="tablist" aria-label="Schrift">
        {scripts.map((s) => (
          <button key={s} role="tab" aria-selected={s === script} className={s === script ? "on" : ""} onClick={() => choose({ script: s })}>
            {SCRIPT_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="glyph-cats">
        {groups.map((group) => (
          <div key={group} className="glyph-cat-group">
            <span className="muted small">{group}</span>
            <div className="chips">
              {categories
                .filter((c) => c.group === group)
                .map((c) => (
                  <CategoryChip key={c.id} cat={c} on={c.id === category.id} glyphs={glyphs} progress={progress} onClick={() => choose({ cat: c.id })} />
                ))}
            </div>
          </div>
        ))}
      </div>

      {error && <Empty>{error}</Empty>}
      {!glyphs && !error && <Empty>Lade Zeichen …</Empty>}

      {glyphs && (
        <>
          <div className="mode-cards">
            {(["recognize", "trace", "master"] as GlyphMode[]).map((mode) => {
              const counts = mode === "recognize" ? readCounts : writeCounts;
              const fresh = Math.min(settings.newPerBlock, counts.total - counts.seen);
              return (
                <button key={mode} className={`mode-card mode-${mode}`} onClick={() => start(mode)} disabled={inCategory.length === 0}>
                  <span className="mc-title">{MODE_INFO[mode].label}</span>
                  <span className="mc-hint small">{MODE_INFO[mode].hint}</span>
                  <span className="mc-count small">
                    {mode === "trace"
                      ? `${Math.min(settings.blockSize, inCategory.length)} Zeichen`
                      : `${counts.due} fällig · ${fresh} neu`}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="row">
            <div className="glyph-progress grow small">
              <ProgressBar label="Lesen" counts={readCounts} />
              <ProgressBar label="Schreiben" counts={writeCounts} />
            </div>
            <div className="segmented" aria-label="Fortschritt anzeigen für">
              <button className={view === "read" ? "on" : ""} onClick={() => setView("read")}>Lesen</button>
              <button className={view === "write" ? "on" : ""} onClick={() => setView("write")}>Schreiben</button>
            </div>
          </div>

          {category.hint && <p className="muted small">{category.label}: {category.hint}</p>}
          <div className={`glyph-grid ${script === "kanji" ? "is-kanji" : ""}`}>
            {inCategory.map((g) => {
              const t = progress.get(g.c)?.[view];
              const status = glyphStatus(t);
              return (
                <button
                  key={g.c}
                  className={`glyph-tile st-${status} ${t && t.dueAt <= now ? "is-due" : ""}`}
                  onClick={() => setDetail(g)}
                  title={`${g.c} · ${g.script === "kanji" ? (g.meanings?.[0] ?? "") : g.romaji} · ${STATUS_LABEL[status]}`}
                >
                  <span className="gt-char" lang="ja">{g.c}</span>
                  <span className="gt-sub">{g.script === "kanji" ? (g.meanings?.[0] ?? "") : g.romaji}</span>
                </button>
              );
            })}
          </div>
          <div className="row small muted glyph-legend">
            <span><i className="dot st-new" /> neu</span>
            <span><i className="dot st-learning" /> lernend</span>
            <span><i className="dot st-review" /> im Gedächtnis</span>
            <span><i className="dot st-mastered" /> sitzt</span>
          </div>
          <p className="muted small">
            Daten:{" "}
            {sources.map((s, i) => (
              <span key={s.name}>
                {i > 0 && " · "}
                <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> ({s.license})
              </span>
            ))}
            . JLPT-Stufen sind Schätzungen (seit 2010 gibt es keine offiziellen Listen).
          </p>
        </>
      )}

      {detail && (
        <GlyphDetail
          lang={lang}
          glyph={detail}
          row={progress.get(detail.c) ?? null}
          onClose={() => {
            setDetail(null);
            if (params.get("c")) {
              const next = new URLSearchParams(params);
              next.delete("c");
              setParams(next, { replace: true });
            }
          }}
          onPractice={(mode) => start(mode, detail)}
        />
      )}
    </div>
  );
}

function CategoryChip({
  cat,
  on,
  glyphs,
  progress,
  onClick,
}: {
  cat: GlyphCategory;
  on: boolean;
  glyphs: GlyphInfo[] | null;
  progress: Map<string, GlyphRow>;
  onClick: () => void;
}) {
  const list = useMemo(() => (glyphs ? cat.pick(glyphs) : []), [glyphs, cat]);
  const known = list.filter((g) => {
    const s = glyphStatus(progress.get(g.c)?.write);
    return s === "review" || s === "mastered";
  }).length;
  return (
    <button className={`chip ${on ? "on" : ""}`} onClick={onClick} aria-pressed={on} title={cat.hint}>
      {cat.label}
      {glyphs && <span className="chip-count"> {known > 0 ? `${known}/` : ""}{list.length}</span>}
    </button>
  );
}

function ProgressBar({ label, counts }: { label: string; counts: ReturnType<typeof glyphCounts> }) {
  const pct = (n: number) => (counts.total ? (n / counts.total) * 100 : 0);
  return (
    <div className="glyph-pbar" title={`${counts.mastered} sitzen · ${counts.review} im Gedächtnis · ${counts.learning} lernend · ${counts.total - counts.seen} neu`}>
      <span className="gp-label">{label}</span>
      <span className="gp-track">
        <span className="st-mastered" style={{ width: `${pct(counts.mastered)}%` }} />
        <span className="st-review" style={{ width: `${pct(counts.review)}%` }} />
        <span className="st-learning" style={{ width: `${pct(counts.learning)}%` }} />
      </span>
      <span className="gp-num">
        {counts.review + counts.mastered}/{counts.total}
      </span>
    </div>
  );
}

function GlyphDetail({
  lang,
  glyph,
  row,
  onClose,
  onPractice,
}: {
  lang: string;
  glyph: GlyphInfo;
  row: GlyphRow | null;
  onClose: () => void;
  onPractice: (mode: GlyphMode) => void;
}) {
  const { collections } = useSession();
  const strokes = useGlyphStrokes(lang, glyph);
  const cards = (useLiveQuery(() => collections.cards).data ?? []) as CardRow[];
  const words = useMemo(
    () => (glyph.script === "kanji" ? cards.filter((c) => !c.deleted && c.lang === lang && c.lemma.includes(glyph.c)).slice(0, 12) : []),
    [cards, glyph, lang],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const now = Date.now();
  const trackLine = (label: string, t: GlyphRow["read"]) => (
    <div className="row small">
      <span className="grow">{label}</span>
      <span className={`badge st-${glyphStatus(t)}`}>{STATUS_LABEL[glyphStatus(t)]}</span>
      {t && <span className="muted">{t.dueAt <= now ? "fällig" : `in ${formatDays((t.dueAt - now) / 86_400_000)}`} · {t.reps}× geübt</span>}
    </div>
  );

  return (
    <div className="sheet" onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-label={`Zeichen ${glyph.c}`}>
      <div className="card stack glyph-detail">
        <div className="row">
          <span className="glyph-detail-char" lang="ja">{glyph.c}</span>
          <div className="grow">
            <GlyphFacts glyph={glyph} />
          </div>
          <button className="small-btn" onClick={onClose} aria-label="Schließen">
            <IconClose size={16} aria-hidden />
          </button>
        </div>
        {strokes ? <GlyphAnimation strokes={strokes} size="min(240px, 70vw)" label={`Strichreihenfolge von ${glyph.c}`} /> : <div className="muted small">Lade Strichdaten …</div>}
        <div className="stack glyph-tracks">
          {trackLine("Lesen", row?.read ?? null)}
          {trackLine("Schreiben (Masterclass)", row?.write ?? null)}
          {!!row?.traces && <div className="muted small">{row.traces}× nachgezeichnet</div>}
        </div>
        <div className="row">
          <button onClick={() => onPractice("trace")}>Nachzeichnen</button>
          <button className="primary" onClick={() => onPractice("master")}>Aus dem Gedächtnis schreiben</button>
          <button onClick={() => onPractice("recognize")}>Erkennen</button>
        </div>
        {words.length > 0 && (
          <div>
            <div className="muted small">In deinem Wortschatz</div>
            <div className="chips">
              {words.map((w) => (
                <Link key={w.id} className="chip" to={`/vocab?card=${w.id}`} lang="ja">
                  {w.lemma}
                  {w.gloss && <span className="muted"> · {w.gloss}</span>}
                </Link>
              ))}
            </div>
          </div>
        )}
        {(row?.read || row?.write || row?.traces) && (
          <button className="link small danger" onClick={() => resetGlyph(collections, lang, glyph)}>Lernstand zurücksetzen</button>
        )}
      </div>
    </div>
  );
}
