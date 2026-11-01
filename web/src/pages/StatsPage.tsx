import { IconAlert, IconCards, IconCheck, IconShield, IconStreak, IconTarget } from "../components/icons";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "@tanstack/react-db";
import { buildPlan, computeInsights, computeStats, LANGUAGES, type Cefr, type LangCode } from "@vochat/shared";
import { AreaChart, BarChart, Heatmap, Meter } from "../components/charts";
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

  const { stats, plan, insights } = useMemo(() => {
    const now = Date.now();
    const today = startOfToday(now);
    const langCards = cards.filter((c) => !c.deleted && c.lang === lang);
    const ids = new Set(langCards.map((c) => c.id));
    const langReviews = reviews.filter((r) => !r.deleted && ids.has(r.cardId));
    const targetCefr = (user.learnLangs.find((l) => l.lang === lang)?.targetCefr ?? null) as Cefr | null;
    return {
      stats: computeStats(langCards.map(toStatsCard), langReviews.map(toStatsReview), now, today),
      plan: buildPlan(langCards.map(toPlannerCard), langReviews, plannerSettings(settings, { targetCefr }), now, today),
      insights: computeInsights(
        langCards.map((c) => ({ ...toStatsCard(c), lemma: c.lemma, cefr: c.cefr, difficulty: c.difficulty, lapses: c.lapses })),
        langReviews.map(toStatsReview),
        today,
        (t) => new Date(t).getHours(),
        371,
      ),
    };
  }, [cards, reviews, lang, settings, user.learnLangs]);

  const update = (patch: Partial<LearningSettings>) => writeLearning({ ...settings, ...patch });
  const today = startOfToday();

  return (
    <div className="stack">
      <div className="row">
        <h1 style={{ margin: 0 }}>Statistik</h1>
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
        <Tile accent icon={<IconCards size={17} />} label="Heute dran" value={`${plan.relearn + plan.due + plan.newAllowed}`} hint={`${plan.due + plan.relearn} Wiederholungen · ${plan.newAllowed} neu · ≈ ${plan.minutes} Min.`} />
        <Tile tone="qt-lime" icon={<IconStreak size={17} />} label="Serie" value={`${stats.streakDays}`} hint="Tage in Folge gelernt" />
        <Tile icon={<IconShield size={17} />} label="Sitzt sicher" value={`${stats.safeNow}`} hint="Erinnerung jetzt ≥ 90 %" />
        <Tile tone="qt-coral" icon={<IconAlert size={17} />} label="Gefährdet" value={`${stats.atRisk}`} hint="Erinnerung unter 70 %" />
        <Tile icon={<IconTarget size={17} />} label="Behaltensquote" value={pct(stats.retention.rate)} hint={`nach ≥ 1 Tag Pause · Ziel ${pct(settings.retention)} · ${stats.retention.n} Antworten`} />
        <Tile tone="qt-lime" icon={<IconCheck size={17} />} label="Heute" value={`${stats.today.reviews}`} hint={`Antworten · ${stats.today.correct} richtig · ${stats.today.minutes} Min.`} />
      </div>
      {plan.notes.length > 0 && <div className="muted small">{plan.notes.join(" ")}</div>}
      <div className="row">
        <Link to="/learn" className="button primary">Lernblock starten</Link>
      </div>

      <section className="card stack">
        <div className="row">
          <h3>Aktivität</h3>
          <span className="spacer" />
          <span className="muted small">letzte Wochen</span>
        </div>
        <Heatmap days={insights.heatmap} />
      </section>

      <div className="stats-grid">
        <section className="card stack">
          <h3>Wortschatz-Wachstum</h3>
          <p className="muted small">Gelernte Wörter insgesamt (ab der ersten Antwort), letzte 90 Tage.</p>
          <AreaChart points={insights.growth} label="Gelernte Wörter" unit="Wörter" />
        </section>

        <section className="card stack">
          <h3>Fällige Wiederholungen</h3>
          <p className="muted small">Nächste 14 Tage – heute inklusive Rückstand.</p>
          <BarChart
            label="Fällige Wiederholungen je Tag"
            data={plan.forecast.map((n, i) => {
              const day = today + i * 86_400_000;
              return { label: i === 0 ? "heute" : WEEKDAY.format(day), value: n, tip: i === 0 ? "Heute" : `${WEEKDAY.format(day)} ${DAY.format(day)}` };
            })}
            highlight={0}
          />
        </section>

        <section className="card stack">
          <h3>Wie fest sitzen deine Wörter?</h3>
          <p className="muted small">Stabilität: so lange behältst du ein Wort mit 90 % Wahrscheinlichkeit.</p>
          <BarChart label="Wörter je Stabilität" data={insights.stability.map((b) => ({ label: b.label, value: b.count }))} format={(n) => `${n} Wörter`} />
        </section>

        <section className="card stack">
          <h3>Wann du lernst</h3>
          {(() => {
            const best = insights.hours.filter((h) => h.reviews >= 10).sort((a, b) => b.correct / b.reviews - a.correct / a.reviews)[0];
            return (
              <p className="muted small">
                Antworten je Uhrzeit.
                {best ? ` Am sichersten um ${best.hour} Uhr (${Math.round((best.correct / best.reviews) * 100)} % richtig).` : ""}
                {insights.avgResponseSec !== null ? ` Ø Antwortzeit ${insights.avgResponseSec.toFixed(1).replace(".", ",")} s.` : ""}
              </p>
            );
          })()}
          <BarChart
            label="Antworten je Stunde"
            data={insights.hours.map((h) => ({ label: `${h.hour}`, value: h.reviews, tip: `${h.hour}–${h.hour + 1} Uhr${h.reviews ? `, ${Math.round((h.correct / h.reviews) * 100)} % richtig` : ""}` }))}
            height={100}
          />
        </section>

        {insights.levels.length > 0 && (
          <section className="card stack">
            <h3>Nach Niveau</h3>
            {insights.levels.map((l) => (
              <Meter key={l.level} label={l.level} value={l.known} total={l.total} />
            ))}
          </section>
        )}

        <section className="card stack">
          <h3>Schwierigste Wörter</h3>
          {insights.hardest.length === 0 ? (
            <p className="muted small">Noch keine – gut so!</p>
          ) : (
            <ol className="hardest">
              {insights.hardest.map((h) => (
                <li key={h.id}>
                  <b>{h.lemma}</b>
                  <span className="muted small">
                    {h.lapses}× vergessen · Schwierigkeit {h.difficulty.toFixed(1).replace(".", ",")}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <Link to="/vocab" className="small">Im Wortschatz ansehen, ignorieren oder öfter üben →</Link>
        </section>
      </div>

      <section className="card stack">
        <h3>Antworten – letzte 30 Tage</h3>
        <BarChart
          label="Antworten je Tag"
          data={stats.daily.map((d) => ({ label: DAY.format(d.day), value: d.reviews, tip: `${DAY.format(d.day)} – ${d.correct} richtig` }))}
          height={90}
        />
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
        <div className="calibration">
          {stats.calibration.filter((b) => b.n > 0).map((b) => (
            <div key={b.label} className="calib-row" role="img" aria-label={`${b.label}: vorhergesagt ${pct(b.predicted)}, tatsächlich ${pct(b.actual)} bei ${b.n} Antworten`}>
              <span className="calib-label small">{b.label}</span>
              <span className="calib-track">
                <span className="calib-actual" style={{ width: `${b.actual * 100}%` }} />
                <span className="calib-pred" style={{ left: `${b.predicted * 100}%` }} title={`Vorhersage ${pct(b.predicted)}`} />
              </span>
              <span className="small">{pct(b.actual)}</span>
            </div>
          ))}
          {stats.calibration.every((b) => b.n === 0) && <p className="muted small">Noch zu wenige Wiederholungen nach mindestens einem Tag Pause.</p>}
          <div className="muted small">Balken = tatsächlich richtig · Strich = Vorhersage des Modells</div>
        </div>
        <details className="small">
          <summary>Als Tabelle</summary>
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
        </details>
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

function Tile({ label, value, hint, icon, accent, tone = "qt-violet" }: { label: string; value: string; hint: string; icon?: ReactNode; accent?: boolean; tone?: string }) {
  return (
    <div className={`tile ${accent ? "accent" : ""}`}>
      {icon && <span className={`tile-icon ${accent ? "" : tone}`}>{icon}</span>}
      <span className="tile-label">{label}</span>
      <span className="tile-value">{value}</span>
      <span className="tile-hint">{hint}</span>
    </div>
  );
}

const clampInt = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
