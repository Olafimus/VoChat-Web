import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  GOAL_DIFFICULTIES,
  GOAL_KIND_LABEL,
  GOAL_KINDS,
  GOAL_TEMPLATES,
  knownWords,
  LANGUAGES,
  LANG_CODES,
  wordsPerDayHint,
  type GoalDifficulty,
  type GoalKind,
  type GoalPace,
  type LangCode,
} from "@vochat/shared";
import { useSession } from "../session";
import { useActiveLang } from "../lib/lang";
import { createGoal, draftFromTemplate, updateGoal, useGoals, type GoalDraft, type GoalView } from "../lib/goals";
import { startOfToday } from "../lib/learning";
import { newId } from "../lib/ids";
import { PageHeader } from "../components/PageHeader";
import { Empty } from "../components/ui";
import { IconCheck, IconClose, IconPlus, IconTarget, IconTrash } from "../components/icons";

const DAY = 86_400_000;

const PACE: Record<GoalPace, { label: string; tone: string }> = {
  reached: { label: "Erreicht", tone: "ok" },
  ahead: { label: "Voraus", tone: "ok" },
  on_track: { label: "Im Plan", tone: "accent" },
  behind: { label: "Hinterher", tone: "warn" },
  overdue: { label: "Frist vorbei", tone: "danger" },
  open: { label: "Ohne Frist", tone: "muted" },
};

const DIFFICULTY_LABEL: Record<GoalDifficulty, string> = { leicht: "Leicht", mittel: "Mittel", ambitioniert: "Ambitioniert" };

const fmtDate = (t: number) => new Date(t).toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });
const fmtNum = (n: number) => (n < 10 && n % 1 !== 0 ? n.toFixed(1).replace(".", ",") : String(Math.ceil(n)));
const toInputDate = (t: number | null) => (t === null ? "" : new Date(t - new Date(t).getTimezoneOffset() * 60_000).toISOString().slice(0, 10));
const fromInputDate = (v: string) => (v ? startOfToday(new Date(`${v}T12:00:00`).getTime()) + DAY - 1 : null);

/** Ziele: Vorlagen nach Schwierigkeit, eigene Ziele, Fortschritt und Tempo. */
export function GoalsPage() {
  const { active, finished } = useGoals();
  const [creating, setCreating] = useState(false);
  const [showDone, setShowDone] = useState(false);

  if (creating) return <NewGoal onDone={() => setCreating(false)} />;

  return (
    <div className="stack">
      <PageHeader
        icon={<IconTarget size={22} />}
        tone="qt-lime"
        title="Ziele"
        subtitle="Was willst du bis wann schaffen? Der Fortschritt rechnet sich von selbst."
        actions={<button className="primary small-btn" onClick={() => setCreating(true)}><IconPlus size={16} aria-hidden /> Neues Ziel</button>}
      />
      {active.length === 0 && (
        <Empty>
          Noch keine aktiven Ziele. <button className="link" onClick={() => setCreating(true)}>Ziel aus einer Vorlage wählen</button>
        </Empty>
      )}
      <ul className="list">
        {active.map((v) => (
          <li key={v.goal.id}>
            <GoalCard view={v} />
          </li>
        ))}
      </ul>
      {finished.length > 0 && (
        <section className="stack">
          <button className="small-btn" aria-expanded={showDone} onClick={() => setShowDone((s) => !s)}>
            {showDone ? "Erreichte & archivierte ausblenden" : `Erreichte & archivierte anzeigen (${finished.length})`}
          </button>
          {showDone && (
            <ul className="list">
              {finished.map((v) => (
                <li key={v.goal.id}>
                  <GoalCard view={v} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

/** Ziel mit Fortschrittsbalken, Tempo und – bei Checklisten – den Punkten zum Abhaken. */
export function GoalCard({ view, compact = false }: { view: GoalView; compact?: boolean }) {
  const { collections } = useSession();
  const { goal, progress: p, collectionTitle } = view;
  const [newItem, setNewItem] = useState("");
  const pace = goal.completedAt !== null ? PACE.reached : PACE[p.pace];
  const pct = Math.round(p.ratio * 100);

  const toggleItem = (id: string) =>
    updateGoal(collections, goal.id, (d) => {
      d.items = d.items.map((i) => (i.id === id ? { ...i, done: !i.done, doneAt: i.done ? null : Date.now() } : i));
      // Haken entfernt: Checkliste ist nicht mehr vollständig
      if (d.items.some((i) => !i.done)) d.completedAt = null;
    });
  const addItem = (e: FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    updateGoal(collections, goal.id, (d) => {
      d.items = [...d.items, { id: newId(), text: newItem.trim(), done: false, doneAt: null }];
      d.completedAt = null;
    });
    setNewItem("");
  };

  const meta = [
    GOAL_KIND_LABEL[goal.kind as GoalKind],
    goal.lang ? LANGUAGES[goal.lang as LangCode]?.name : null,
    collectionTitle ? `„${collectionTitle}“` : null,
    goal.deadline ? `bis ${fmtDate(goal.deadline)}` : null,
  ].filter(Boolean);

  return (
    <article className={`card goal-card stack ${compact ? "compact" : ""}`}>
      <div className="row">
        <b className="goal-title">{goal.title}</b>
        <span className="spacer" />
        <span className={`badge pace-${pace.tone}`}>{pace.label}</span>
      </div>
      {!compact && <div className="muted small">{meta.join(" · ")}</div>}
      <div className="goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`${goal.title}: ${pct} %`}>
        <span style={{ width: `${pct}%` }} />
        {p.timeRatio !== null && !p.reached && <i style={{ left: `${Math.round(p.timeRatio * 100)}%` }} title="Wo du nach der Zeit stehen solltest" />}
      </div>
      <div className="row small goal-numbers">
        <span>
          <b>{p.current}</b> / {p.target} {p.unit}
        </span>
        <span className="spacer" />
        {p.missingCollection ? (
          <span className="error">Sammlung nicht gefunden</span>
        ) : p.reached || goal.completedAt ? (
          <span className="icon-line"><IconCheck size={14} aria-hidden /> geschafft{goal.completedAt ? ` am ${fmtDate(goal.completedAt)}` : ""}</span>
        ) : p.daysLeft !== null ? (
          <span className="muted">
            {p.pace === "overdue" ? "Frist abgelaufen" : `noch ${p.daysLeft} ${p.daysLeft === 1 ? "Tag" : "Tage"}`}
            {p.perDay !== null && p.pace !== "overdue" && goal.kind !== "streak" && goal.kind !== "checklist" && ` · ≈ ${fmtNum(p.perDay)} ${p.unit === "%" ? "%" : p.unit}/Tag`}
          </span>
        ) : null}
      </div>
      {goal.kind === "checklist" && !compact && (
        <>
          <ul className="list compact goal-items">
            {goal.items.map((i) => (
              <li key={i.id}>
                <label className="inline">
                  <input type="checkbox" checked={i.done} onChange={() => toggleItem(i.id)} />
                  <span className={i.done ? "done" : ""}>{i.text}</span>
                </label>
              </li>
            ))}
          </ul>
          {!goal.archived && (
            <form className="row nowrap" onSubmit={addItem}>
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Weiterer Punkt …" aria-label="Punkt hinzufügen" maxLength={200} />
              <button className="small-btn" disabled={!newItem.trim()}><IconPlus size={15} aria-hidden /></button>
            </form>
          )}
        </>
      )}
      {goal.kind === "collection" && !compact && goal.collectionId && (
        <Link to={`/paths?open=${encodeURIComponent(goal.collectionId)}`} className="small">Fehlende Wörter ansehen</Link>
      )}
      {!compact && <GoalActions view={view} />}
    </article>
  );
}

function GoalActions({ view }: { view: GoalView }) {
  const { collections } = useSession();
  const { goal } = view;
  const [editing, setEditing] = useState(false);
  const [target, setTarget] = useState(goal.target);
  const [deadline, setDeadline] = useState(toInputDate(goal.deadline));
  if (editing) {
    return (
      <form
        className="row goal-edit"
        onSubmit={(e) => {
          e.preventDefault();
          updateGoal(collections, goal.id, (d) => {
            d.target = Math.max(1, Math.round(target));
            d.deadline = fromInputDate(deadline);
            d.completedAt = null; // wird neu bewertet
          });
          setEditing(false);
        }}
      >
        {goal.kind !== "checklist" && (
          <label>
            Ziel
            <input type="number" min={1} max={goal.kind === "collection" ? 100 : 100000} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          </label>
        )}
        <label>
          Frist
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <button className="primary small-btn">Speichern</button>
        <button type="button" className="small-btn" onClick={() => setEditing(false)}>Abbrechen</button>
      </form>
    );
  }
  return (
    <div className="row">
      <button className="small-btn" onClick={() => setEditing(true)}>Anpassen</button>
      <button className="small-btn" onClick={() => updateGoal(collections, goal.id, (d) => { d.archived = !d.archived; })}>
        {goal.archived ? "Wieder aktivieren" : "Archivieren"}
      </button>
      <button
        className="small-btn danger"
        aria-label={`Ziel ${goal.title} löschen`}
        onClick={() => window.confirm(`Ziel „${goal.title}“ löschen?`) && updateGoal(collections, goal.id, (d) => { d.deleted = true; })}
      >
        <IconTrash size={15} />
      </button>
    </div>
  );
}

function NewGoal({ onDone }: { onDone: () => void }) {
  const { collections } = useSession();
  const { cards, own } = useGoals();
  const [activeLang, , learning] = useActiveLang();
  const [difficulty, setDifficulty] = useState<GoalDifficulty>("leicht");
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const langs = (learning.length ? learning : LANG_CODES) as LangCode[];

  if (draft) return <GoalForm initial={draft} langs={langs} own={own} cards={cards} onCancel={() => setDraft(null)} onSave={(d) => { createGoal(collections, cards, d); onDone(); }} />;

  const blank: GoalDraft = { title: "", kind: "words_new", target: 100, lang: activeLang, collectionId: null, deadline: startOfToday() + 60 * DAY + DAY - 1, items: [], template: null, difficulty: null };
  return (
    <div className="stack">
      <PageHeader
        icon={<IconTarget size={22} />}
        tone="qt-lime"
        title="Neues Ziel"
        actions={<button className="small-btn" onClick={onDone}><IconClose size={15} aria-hidden /> Abbrechen</button>}
      />
      <div className="segmented three" role="tablist">
        {GOAL_DIFFICULTIES.map((d) => (
          <button key={d} role="tab" aria-selected={difficulty === d} className={difficulty === d ? "on" : ""} onClick={() => setDifficulty(d)}>
            {DIFFICULTY_LABEL[d]}
          </button>
        ))}
      </div>
      <div className="template-grid">
        {GOAL_TEMPLATES.filter((t) => t.difficulty === difficulty).map((t) => (
          <button key={t.id} className={`card template-card diff-${t.difficulty}`} onClick={() => setDraft(draftFromTemplate(t, activeLang))}>
            <b>{t.title}</b>
            <span className="muted small">{t.description}</span>
            <span className="badge subtle">{GOAL_KIND_LABEL[t.kind]}{t.days ? ` · ${t.days} Tage` : ""}</span>
          </button>
        ))}
      </div>
      <button className="small-btn" onClick={() => setDraft(blank)}><IconPlus size={15} aria-hidden /> Eigenes Ziel ohne Vorlage</button>
      <div className="muted small">Bekannt zählt ein Wort, sobald es gefestigt ist (Status „wiederholen“ oder „gemeistert“). Dasselbe Wort zählt nur einmal.</div>
      <div className="muted small">Aktuell kennst du {knownWords(cards, null)} Wörter{activeLang ? `, davon ${knownWords(cards, activeLang)} auf ${LANGUAGES[activeLang].name}` : ""}.</div>
    </div>
  );
}

function GoalForm({
  initial,
  langs,
  own,
  cards,
  onCancel,
  onSave,
}: {
  initial: GoalDraft;
  langs: LangCode[];
  own: ReturnType<typeof useGoals>["own"];
  cards: ReturnType<typeof useGoals>["cards"];
  onCancel: () => void;
  onSave: (d: GoalDraft) => void;
}) {
  const [d, setD] = useState<GoalDraft>(initial);
  const set = (patch: Partial<GoalDraft>) => setD((x) => ({ ...x, ...patch }));
  const collectionsOfLang = own.filter((c) => !c.deleted);
  const wordGoal = d.kind === "words_new" || d.kind === "words_total" || d.kind === "words_added";

  // Einschätzung: nötiges Tempo bis zur Frist
  const hint = useMemo(() => {
    if (!wordGoal || d.deadline === null) return null;
    const days = Math.max(1, Math.ceil((d.deadline - Date.now()) / DAY));
    const missing = d.kind === "words_total" ? Math.max(0, d.target - knownWords(cards, d.lang)) : d.target;
    if (missing === 0) return { text: "Das hast du schon geschafft.", level: "leicht" as const };
    const perDay = missing / days;
    const h = wordsPerDayHint(perDay);
    return { text: `≈ ${fmtNum(perDay)} Wörter pro Tag – ${h.text}`, level: h.level };
  }, [wordGoal, d.deadline, d.kind, d.target, d.lang, cards]);

  const valid =
    d.title.trim().length > 0 &&
    d.target >= 1 &&
    (d.kind !== "collection" || (!!d.collectionId && d.target <= 100)) &&
    (d.kind !== "checklist" || d.items.some((i) => i.trim()));

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(d);
      }}
    >
      <PageHeader icon={<IconTarget size={22} />} tone="qt-lime" title={initial.template ? "Vorlage anpassen" : "Eigenes Ziel"} />
      <div className="card stack">
        <label>
          Titel
          <input required value={d.title} maxLength={160} onChange={(e) => set({ title: e.target.value })} placeholder="z. B. 500 Wörter bis zum Urlaub" />
        </label>
        <label>
          Art
          <select value={d.kind} onChange={(e) => set({ kind: e.target.value as GoalKind, target: e.target.value === "collection" ? 80 : d.target })}>
            {GOAL_KINDS.map((k) => <option key={k} value={k}>{GOAL_KIND_LABEL[k]}</option>)}
          </select>
        </label>
        {d.kind === "collection" && (
          <label>
            Sammlung oder eigener Lernpfad
            <select value={d.collectionId ?? ""} onChange={(e) => set({ collectionId: e.target.value || null })} required>
              <option value="">– wählen –</option>
              {collectionsOfLang.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.items.length} Wörter)</option>)}
            </select>
            {collectionsOfLang.length === 0 && <span className="muted small">Noch keine eigene Sammlung. <Link to="/paths">Unter Lernpfade → Meine anlegen</Link>.</span>}
          </label>
        )}
        <div className="row">
          {d.kind !== "checklist" && (
            <label style={{ flex: 1 }}>
              {d.kind === "collection" ? "Anteil bekannt (%)" : d.kind === "streak" ? "Tage am Stück" : d.kind === "reviews" ? "Antworten" : "Wörter"}
              <input type="number" min={1} max={d.kind === "collection" ? 100 : 100000} value={d.target} onChange={(e) => set({ target: Number(e.target.value) })} />
            </label>
          )}
          {wordGoal && (
            <label style={{ flex: 1 }}>
              Sprache
              <select value={d.lang ?? ""} onChange={(e) => set({ lang: e.target.value || null })}>
                <option value="">Alle Sprachen</option>
                {langs.map((l) => <option key={l} value={l}>{LANGUAGES[l].name}</option>)}
              </select>
            </label>
          )}
          <label style={{ flex: 1 }}>
            Frist (optional)
            <input type="date" value={toInputDate(d.deadline)} min={toInputDate(Date.now())} onChange={(e) => set({ deadline: fromInputDate(e.target.value) })} />
          </label>
        </div>
        {d.kind === "words_new" && <div className="muted small">Zählt Wörter, die du ab heute neu sicher kannst (heute bekannt: {knownWords(cards, d.lang)}).</div>}
        {hint && <div className={`small goal-hint level-${hint.level}`}>{hint.text}</div>}
        {d.kind === "checklist" && (
          <div className="field">
            <div className="row field-head"><label>Punkte</label></div>
            {d.items.map((item, i) => (
              <div className="row nowrap" key={i}>
                <input value={item} aria-label={`Punkt ${i + 1}`} maxLength={200} onChange={(e) => set({ items: d.items.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" className="small-btn danger" aria-label="Punkt entfernen" onClick={() => set({ items: d.items.filter((_, j) => j !== i) })}><IconTrash size={15} /></button>
              </div>
            ))}
            <button type="button" className="small-btn" disabled={d.items.length >= 50} onClick={() => set({ items: [...d.items, ""] })}><IconPlus size={15} aria-hidden /> Punkt</button>
          </div>
        )}
      </div>
      <div className="row">
        <button className="primary" disabled={!valid}>Ziel speichern</button>
        <button type="button" className="small-btn" onClick={onCancel}>Zurück</button>
      </div>
    </form>
  );
}
