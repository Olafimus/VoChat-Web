import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "@tanstack/react-db";
import { buildPlan, computeStats, LANGUAGES, type Cefr, type LangCode } from "@vochat/shared";
import { useSession } from "../session";
import { useActiveLang } from "../lib/lang";
import type { CardRow, ReviewRow } from "../local/collections";
import {
  DEFAULT_LEARNING,
  formatDays,
  plannerSettings,
  startOfToday,
  toPlannerCard,
  toStatsCard,
  toStatsReview,
  useLearningSettings,
  writeLearning,
  type LearningSettings,
} from "../lib/learning";

const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)} %`);
const WEEKDAY = new Intl.DateTimeFormat("de-DE", { weekday: "short" });
const DAY = new Intl.DateTimeFormat("de-DE", { day: "numeric", month: "numeric" });

/** Statistik und Lern-Einstellungen – macht sichtbar, wie der Planer entscheidet. */
export function StatsPage() {
  const { collections, user } = useSession();
  const [lang, setLang, learning] = useActiveLang();
  const settings = useLearningSettings();
  const cards = (useLiveQuery(() => collections.cards).data ?? []) as CardRow[];
  const reviews = (useLiveQuery(() => collections.reviews).data ?? []) as ReviewRow[];

  const { stats, plan } = useMemo(() => {
    const now = Date.now();
    const today = startOfToday(now);
    const langCards = cards.filter((c) => !c.deleted && c.lang === lang);
    const ids = new Set(langCards.map((c) => c.id));
    const langReviews = reviews.filter((r) => !r.deleted && ids.has(r.cardId));
    const targetCefr = (user.learnLangs.find((l) => l.lang === lang)?.targetCefr ?? null) as Cefr | null;
    return {
      stats: computeStats(langCards.map(toStatsCard), langReviews.map(toStatsReview), now, today),
      plan: buildPlan(langCards.map(toPlannerCard), langReviews, plannerSettings(settings, { targetCefr }), now, today),
    };
  }, [cards, reviews, lang, settings, user.learnLangs]);

  const update = (patch: Partial<LearningSettings>) => writeLearning({ ...settings, ...patch });
  const maxForecast = Math.max(1, ...plan.forecast);
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.reviews));
  const today = startOfToday();

  return (
    <div className="stack">
      <div className="row">
        <h2 style={{ margin: 0 }}>Statistik</h2>
        <span className="spacer" />
        {learning.length > 1 && (
          <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)} aria-label="Lernsprache">
            {learning.map((l) => (
              <option key={l} value={l}>{LANGUAGES[l as LangCode].name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="tiles">
        <Tile label="Heute dran" value={`${plan.relearn + plan.due + plan.newAllowed}`} hint={`${plan.due + plan.relearn} Wiederholungen · ${plan.newAllowed} neu · ≈ ${plan.minutes} Min.`} />
        <Tile label="Serie" value={`${stats.streakDays} 🔥`} hint="Tage in Folge gelernt" />
        <Tile label="Sitzt sicher" value={`${stats.safeNow}`} hint="Erinnerung jetzt ≥ 90 %" />
        <Tile label="Gefährdet" value={`${stats.atRisk}`} hint="Erinnerung unter 70 %" />
        <Tile label="Behaltensquote" value={pct(stats.retention.rate)} hint={`nach ≥ 1 Tag Pause · Ziel ${pct(settings.retention)} · ${stats.retention.n} Antworten`} />
        <Tile label="Heute" value={`${stats.today.reviews}`} hint={`Antworten · ${stats.today.correct} richtig · ${stats.today.minutes} Min.`} />
      </div>
      {plan.notes.length > 0 && <div className="muted small">{plan.notes.join(" ")}</div>}
      <div className="row">
        <Link to="/learn" className="button primary">Lernblock starten</Link>
      </div>

      <section className="card stack">
        <h3>Fällige Wiederholungen – nächste 14 Tage</h3>
        <div className="bars" role="img" aria-label="Fällige Wiederholungen je Tag">
          {plan.forecast.map((n, i) => {
            const day = today + i * 86_400_000;
            const label = i === 0 ? "heute" : WEEKDAY.format(day);
            return (
              <div key={i} className="bar-col" title={`${i === 0 ? "Heute (inkl. Rückstand)" : `${WEEKDAY.format(day)} ${DAY.format(day)}`}: ${n} Wiederholungen`}>
                <span className="bar-area">
                  <span className="bar-value">{n > 0 ? n : ""}</span>
                  <span className="bar" style={{ height: `${(n / maxForecast) * 100}%` }} />
                </span>
                <span className="bar-label">{label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card stack">
        <h3>Antworten – letzte 30 Tage</h3>
        <div className="bars thin" role="img" aria-label="Antworten je Tag, letzte 30 Tage">
          {stats.daily.map((d) => (
            <div key={d.day} className="bar-col" title={`${DAY.format(d.day)}: ${d.reviews} Antworten, ${d.correct} richtig`}>
              <span className="bar-area">
                <span className="bar" style={{ height: `${(d.reviews / maxDaily) * 100}%` }} />
              </span>
            </div>
          ))}
        </div>
        <div className="muted small">
          Karten: {stats.cards.new} neu · {stats.cards.learning} lernend · {stats.cards.review} in Wiederholung · {stats.cards.mastered} sitzen
          (Stabilität ≥ 60 Tage) · {stats.cards.ignored} ignoriert
          {stats.medianStability !== null && ` · typische Stabilität ${formatDays(stats.medianStability)}`}
        </div>
      </section>

      <section className="card stack">
        <h3>Passt das Modell zu dir?</h3>
        <p className="muted small">
          Vor jeder Antwort sagt das Modell voraus, wie wahrscheinlich du das Wort noch weißt. Hier steht, wie oft du dann tatsächlich
          richtig lagst. Liegen die Werte nah beieinander, sind die Abstände gut gewählt. Antworten am selben Tag zählen nicht mit
          (dort: {pct(stats.sameDay.rate)} richtig bei {stats.sameDay.n} Antworten).
        </p>
        <div className="table-scroll">
          <table className="history-table">
            <thead>
              <tr><th>Bereich</th><th>Ø Modell</th><th>Richtig</th><th>Anz.</th></tr>
            </thead>
            <tbody>
              {stats.calibration.map((b) => (
                <tr key={b.label}>
                  <td>{b.label}</td>
                  <td>{b.n ? pct(b.predicted) : "–"}</td>
                  <td>{b.n ? pct(b.actual) : "–"}</td>
                  <td>{b.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card stack">
        <h3>Einstellungen</h3>
        <label>
          Zielquote: {pct(settings.retention)}
          <input type="range" min={0.8} max={0.97} step={0.01} value={settings.retention} onChange={(e) => update({ retention: Number(e.target.value) })} />
          <span className="muted small">
            Höher = du weißt mehr sicher, wiederholst aber deutlich öfter. 90 % ist ein guter Mittelweg. Gilt für künftige Antworten; einzelne
            Wörter kannst du im Wortschatz auf „öfter“ oder „seltener“ stellen.
          </span>
        </label>
        <div className="row wrap">
          <label className="inline">
            Neue Wörter pro Tag
            <input type="number" min={0} max={100} value={settings.newPerDay} onChange={(e) => update({ newPerDay: clampInt(e.target.value, 0, 100) })} style={{ width: "5rem" }} />
          </label>
          <label className="inline">
            Lernblock
            <input type="number" min={5} max={100} value={settings.blockSize} onChange={(e) => update({ blockSize: clampInt(e.target.value, 5, 100) })} style={{ width: "5rem" }} />
          </label>
          <label className="inline">
            Keine neuen ab
            <input type="number" min={20} max={1000} value={settings.maxReviewsPerDay} onChange={(e) => update({ maxReviewsPerDay: clampInt(e.target.value, 20, 1000) })} style={{ width: "5rem" }} />
            Wiederholungen
          </label>
        </div>
        <button className="small-btn" onClick={() => writeLearning(DEFAULT_LEARNING)}>Standard wiederherstellen</button>
      </section>

      <section className="card stack small">
        <h3>So entscheidet der Planer</h3>
        <ol className="explain">
          <li>
            <b>Gedächtnismodell (FSRS):</b> Jedes Wort hat eine <i>Stabilität</i> (nach so vielen Tagen weißt du es noch zu 90 %) und eine{" "}
            <i>Schwierigkeit</i>. Beide werden aus allen deinen Antworten berechnet.
          </li>
          <li>
            <b>Zeitlicher Abstand zählt:</b> Eine richtige Antwort bringt umso mehr, je eher du das Wort schon hättest vergessen können. Richtig
            nach einer Woche Pause lässt die Stabilität stark wachsen, richtig fünf Sekunden nach einem Fehler fast gar nicht.
          </li>
          <li>
            <b>Wiederholen:</b> Ein Wort ist fällig, wenn seine Erinnerung unter deine Zielquote fällt. Was am ehesten vergessen ist, kommt zuerst;
            falsch Beantwortetes kommt nach ein paar Minuten noch einmal.
          </li>
          <li>
            <b>Neue Wörter:</b> nach Wichtigkeit – häufige Wörter, passendes Niveau, Wörter aus laufenden Challenges und selbst gefundene zuerst.
            Begrenzt pro Tag und gebremst, wenn sich Wiederholungen stauen.
          </li>
          <li>
            <b>Du entscheidest mit:</b> Im Wortschatz kannst du Wörter ignorieren, als bekannt markieren, vorziehen, öfter oder seltener
            wiederholen oder zurücksetzen. Beim Lernen zeigt „warum?“ die Gründe für jede Karte.
          </li>
        </ol>
      </section>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="tile-hint">{hint}</span>
    </div>
  );
}

const clampInt = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
