import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "@tanstack/react-db";
import { buildPlan, computeStats, LANGUAGES, type ChallengeDetail, type ChallengeSummary, type Cefr, type LangCode } from "@vochat/shared";
import { challenges, notifications, social, type NotificationView } from "../api/client";
import { useSession } from "../session";
import { useActiveLang } from "../lib/lang";
import { prefs } from "../lib/prefs";
import type { CardRow, ReviewRow } from "../local/collections";
import { plannerSettings, startOfToday, toPlannerCard, toStatsCard, toStatsReview, useLearningSettings } from "../lib/learning";
import { Empty } from "../components/ui";
import { useConversations } from "../lib/useChats";
import { InstallApp } from "../components/PwaBanner";
import { useGoals } from "../lib/goals";
import { GoalCard } from "./GoalsPage";
import { IconBell, IconCards, IconChats, IconCheck, IconDone, IconEdit, IconPlay, IconScan, IconStats, IconStreak, IconTarget, IconTimer, IconTrophy } from "../components/icons";

const SEEN_KEY = "vochat.notificationsSeen";
const daysLeft = (end: number) => Math.max(0, Math.ceil((end - Date.now()) / 86_400_000));
const ago = (t: number) => {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 60) return `vor ${Math.max(1, m)} Min.`;
  if (m < 24 * 60) return `vor ${Math.round(m / 60)} Std.`;
  return `vor ${Math.round(m / 1440)} Tagen`;
};

/** Startseite: heutige Lernblöcke, offene Challenges und Neuigkeiten auf einen Blick. */
export function HomePage() {
  const { collections, user, token } = useSession();
  const [, setLang, learning] = useActiveLang();
  const settings = useLearningSettings();
  const navigate = useNavigate();
  const cards = (useLiveQuery(() => collections.cards).data ?? []) as CardRow[];
  const reviews = (useLiveQuery(() => collections.reviews).data ?? []) as ReviewRow[];

  const perLang = useMemo(() => {
    const now = Date.now();
    const today = startOfToday(now);
    return learning.map((lang) => {
      const langCards = cards.filter((c) => !c.deleted && c.lang === lang);
      const ids = new Set(langCards.map((c) => c.id));
      const langReviews = reviews.filter((r) => !r.deleted && ids.has(r.cardId));
      const targetCefr = (user.learnLangs.find((l) => l.lang === lang)?.targetCefr ?? null) as Cefr | null;
      const plan = buildPlan(langCards.map(toPlannerCard), langReviews, plannerSettings(settings, { targetCefr }), now, today);
      const stats = computeStats(langCards.map(toStatsCard), langReviews.map(toStatsReview), now, today);
      return { lang: lang as LangCode, plan, stats, total: langCards.length };
    });
  }, [cards, reviews, learning, settings, user.learnLangs]);

  const streak = Math.max(0, ...perLang.map((p) => p.stats.streakDays));
  const todayCount = perLang.reduce((n, p) => n + p.stats.today.reviews, 0);
  const start = (lang: LangCode) => {
    setLang(lang);
    navigate("/learn");
  };

  return (
    <div className="stack home">
      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">{new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}</span>
          <h1>
            Hallo{user.name ? `, ${user.name}` : ""}<span className="hero-dot">.</span>
          </h1>
          <div className="hero-chips">
            <span className={`streak-chip ${streak > 0 ? "on" : ""}`}>
              <IconStreak size={16} /> {streak > 0 ? `${streak} ${streak === 1 ? "Tag" : "Tage"} Serie` : "Starte heute eine Serie"}
            </span>
            {todayCount > 0 && (
              <span className="soft-chip">
                <IconCheck size={15} aria-hidden /> heute {todayCount} Antworten
              </span>
            )}
          </div>
        </div>
        <div className="quick">
          <Link to="/scan" className="quick-tile">
            <span className="qt-icon qt-coral"><IconScan size={20} /></span>
            Foto scannen
          </Link>
          <Link to="/chat" className="quick-tile">
            <span className="qt-icon qt-violet"><IconChats size={20} /></span>
            Chats
          </Link>
          <Link to="/stats" className="quick-tile">
            <span className="qt-icon qt-lime"><IconStats size={20} /></span>
            Statistik
          </Link>
          <InstallApp compact />
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title"><IconCards size={20} aria-hidden /> Heute lernen</h2>
        {perLang.length === 0 && <Empty>Wähle im Profil eine Sprache, die du lernen willst.</Empty>}
        <div className="home-grid">
          {perLang.map(({ lang, plan, total, stats }) => {
            const reviewsDue = plan.due + plan.relearn;
            const nothing = reviewsDue + plan.newAllowed === 0;
            const done = stats.today.reviews;
            const goal = done + reviewsDue + plan.newAllowed;
            return (
              <div key={lang} className="card block-card">
                <ProgressRing value={goal ? done / goal : 1} label={nothing ? "fertig" : `${Math.round((goal ? done / goal : 1) * 100)} %`} />
                <div className="stack block-body">
                  <div className="row">
                    <b className="block-lang">{LANGUAGES[lang].name}</b>
                    <span className="spacer" />
                    <span className="muted small">{total} Wörter</span>
                  </div>
                  {total === 0 ? (
                    <p className="muted small">Noch keine Wörter. <Link to="/paths">Lernpfad wählen</Link> oder <Link to="/scan">Text scannen</Link>.</p>
                  ) : nothing ? (
                    <p className="small icon-line"><IconDone size={16} aria-hidden /> Alles erledigt. Morgen fällig: {plan.forecast[1] ?? 0}.</p>
                  ) : (
                    <>
                      <div className="block-numbers">
                        <span><b>{reviewsDue}</b> wiederholen</span>
                        <span><b>{plan.newAllowed}</b> neu</span>
                        <span className="icon-line"><IconTimer size={14} aria-hidden /> <b>{plan.minutes}</b> Min.</span>
                      </div>
                      {plan.notes[0] && <p className="muted small">{plan.notes[0]}</p>}
                      <button className="primary" onClick={() => start(lang)}>
                        <IconPlay size={16} fill="currentColor" aria-hidden /> Lernblock starten · {Math.min(settings.blockSize, plan.items.length)}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <GoalsSection />

      {(() => {
        const n = cards.filter((c) => !c.deleted && c.pendingUpdate).length;
        return n > 0 ? (
          <Link to="/vocab" className="card notice-link">
            <span className="qt-icon qt-coral"><IconEdit size={18} /></span>
            <span>
              <b>{n} {n === 1 ? "Wort" : "Wörter"}</b> in deiner Sammlung {n === 1 ? "wurde" : "wurden"} im Wörterbuch korrigiert – ansehen und entscheiden
            </span>
          </Link>
        ) : null;
      })()}

      {token && <ChatSection token={token} />}

      {token ? <SocialSection token={token} /> : (
        <section className="card small">
          Mit einem <Link to="/profile">Konto</Link> kannst du Challenges mit Freunden spielen, Fortschritt synchronisieren und Neuigkeiten sehen.
        </section>
      )}
    </div>
  );
}

function ChatSection({ token }: { token: string }) {
  const { user } = useSession();
  const { list } = useConversations(token);
  const unread = (list ?? []).filter((c) => c.unread > 0);
  if (!list) return null;
  return (
    <section className="stack">
      <div className="row">
        <h2 className="section-title"><IconChats size={20} aria-hidden /> Nachrichten {unread.length > 0 && <span className="badge">{unread.reduce((n, c) => n + c.unread, 0)} neu</span>}</h2>
        <span className="spacer" />
        <Link to="/chat" className="small">alle Chats</Link>
      </div>
      {unread.length === 0 ? (
        <div className="card small muted">Keine ungelesenen Nachrichten.</div>
      ) : (
        <ul className="conv-list card">
          {unread.slice(0, 4).map((c) => (
            <li key={c.id}>
              <Link to={`/chat/${c.id}`} className="conv-item unread">
                <span className="conv-main">
                  <span className="row conv-top">
                    <b className="conv-name">{c.title}</b>
                    <span className="spacer" />
                    <span className="unread-badge">{c.unread}</span>
                  </span>
                  <span className="conv-preview muted small">
                    {c.lastMessage?.authorId === user.id ? "Du: " : ""}
                    {c.lastMessage?.preview}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SocialSection({ token }: { token: string }) {
  const navigate = useNavigate();
  const [list, setList] = useState<ChallengeSummary[] | null>(null);
  const [details, setDetails] = useState<Record<string, ChallengeDetail>>({});
  const [news, setNews] = useState<NotificationView[] | null>(null);
  const [seen] = useState(() => Number(prefs.get(SEEN_KEY) ?? 0));
  const [error, setError] = useState(false);

  const load = () => {
    challenges
      .list(token)
      .then(async (l) => {
        const now = Date.now();
        const open = l.filter((c) => c.endsAt > now && c.myStatus !== "declined");
        setList(open);
        const active = open.filter((c) => c.myStatus === "accepted").slice(0, 4);
        const ds = await Promise.all(active.map((c) => challenges.get(token, c.id).catch(() => null)));
        setDetails(Object.fromEntries(ds.filter((d): d is ChallengeDetail => !!d).map((d) => [d.id, d])));
      })
      .catch(() => setError(true));
    notifications.list(token).then(setNews).catch(() => setError(true));
  };
  useEffect(load, [token]);
  // Beim Verlassen gelten Neuigkeiten als gesehen.
  useEffect(() => () => prefs.set(SEEN_KEY, String(Date.now())), []);

  const openTarget = (n: NotificationView) => {
    if (!n.target) return;
    const [type, id] = n.target.split(/:(.*)/s);
    if (type === "challenge") navigate(`/community?challenge=${encodeURIComponent(id)}`);
    else if (type === "user") navigate(`/users/${id}`);
    else navigate("/community?tab=mitmachen");
  };
  const respond = async (id: string, action: "accept" | "decline") => {
    await challenges.act(token, id, action).catch(() => undefined);
    load();
  };
  const friend = async (userId: string, accept: boolean) => {
    await social.friendRespond(token, userId, accept ? "accept" : "decline").catch(() => undefined);
    load();
  };

  const invites = list?.filter((c) => c.myStatus === "invited") ?? [];
  const active = list?.filter((c) => c.myStatus === "accepted") ?? [];
  const unread = news?.filter((n) => n.at > seen).length ?? 0;

  return (
    <>
      <section className="stack">
        <div className="row">
          <h2 className="section-title"><IconTrophy size={20} aria-hidden /> Challenges</h2>
          <span className="spacer" />
          <Link to="/community" className="small">alle</Link>
        </div>
        {error && <div className="muted small">Offline – Challenges und Neuigkeiten erscheinen, sobald du verbunden bist.</div>}
        {list && invites.length + active.length === 0 && (
          <div className="card small">
            Gerade keine laufende Challenge. <Link to="/community">Wochen-Challenge mitmachen</Link> oder einem Freund ein Arbeitsbuch schicken.
          </div>
        )}
        <div className="home-grid">
          {invites.map((c) => (
            <div key={c.id} className="card stack">
              <div><b>{c.title}</b> <span className="badge subtle">Einladung</span></div>
              <div className="muted small">von {c.creatorName ?? "?"} · {c.itemCount} Wörter · {daysLeft(c.endsAt)} Tage</div>
              <div className="row">
                <button className="primary small-btn" onClick={() => respond(c.id, "accept")}>Annehmen</button>
                <button className="small-btn" onClick={() => respond(c.id, "decline")}>Ablehnen</button>
              </div>
            </div>
          ))}
          {active.map((c) => {
            const d = details[c.id];
            const rank = d ? d.leaderboard.findIndex((e) => e.isMe) + 1 : 0;
            const me = d?.leaderboard.find((e) => e.isMe);
            return (
              <button key={c.id} className="card stack challenge-tile" onClick={() => navigate(`/community?challenge=${encodeURIComponent(c.id)}`)}>
                <b>{c.title}</b>
                <span className="muted small">
                  {LANGUAGES[c.lang as LangCode]?.name ?? c.lang} · noch {daysLeft(c.endsAt)} {daysLeft(c.endsAt) === 1 ? "Tag" : "Tage"}
                </span>
                {d && me && (
                  <span className="small">
                    Platz <b>{rank}</b> von {d.leaderboard.length} · {me.known}/{c.itemCount} Wörter · {me.points} Punkte
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="stack">
        <h2 className="section-title">
          <IconBell size={20} aria-hidden /> Neuigkeiten {unread > 0 && <span className="badge">{unread} neu</span>}
        </h2>
        {news?.length === 0 && <div className="card small muted">Noch nichts Neues.</div>}
        {news && news.length > 0 && (
          <ul className="card news-list">
            {news.slice(0, 8).map((n, i) => (
              <li key={`${n.kind}-${n.at}-${i}`} className={n.at > seen ? "unread" : ""}>
                <button className="link news-item" onClick={() => openTarget(n)}>
                  {n.actor && <b>{n.actor.name} </b>}
                  {n.text}
                  <span className="muted small"> · {ago(n.at)}</span>
                </button>
                {n.kind === "friend_request" && n.actor && (
                  <span className="row">
                    <button className="small-btn primary" onClick={() => friend(n.actor!.id, true)}>Annehmen</button>
                    <button className="small-btn" onClick={() => friend(n.actor!.id, false)}>Ablehnen</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Fortschrittsring (heute erledigt von geplant) mit Verlauf. */
function ProgressRing({ value, label }: { value: number; label: string }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg className="ring" width="76" height="76" viewBox="0 0 76 76" role="img" aria-label={`Heute erledigt: ${label}`}>
      <defs>
        <linearGradient id="ring-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--coral)" />
        </linearGradient>
      </defs>
      <circle cx="38" cy="38" r={r} className="ring-track" />
      {v > 0 && <circle cx="38" cy="38" r={r} className="ring-value" stroke="url(#ring-g)" strokeDasharray={`${c * v} ${c}`} transform="rotate(-90 38 38)" />}
      <text x="38" y="43" textAnchor="middle" className="ring-label">{label}</text>
    </svg>
  );
}

/** Aktive Ziele mit Stand – die nächsten Fristen zuerst. */
function GoalsSection() {
  const { active } = useGoals();
  return (
    <section className="stack">
      <div className="row">
        <h2 className="section-title"><IconTarget size={20} aria-hidden /> Deine Ziele</h2>
        <span className="spacer" />
        <Link to="/goals" className="small">{active.length ? "Alle Ziele" : "Ziel setzen"}</Link>
      </div>
      {active.length === 0 ? (
        <Link to="/goals" className="card notice-link">
          <span className="qt-icon qt-lime"><IconTarget size={18} /></span>
          <span>Setz dir ein Ziel – z. B. <b>50 neue Wörter in 30 Tagen</b> oder eine Sammlung bis zum Urlaub. Vorlagen von leicht bis ambitioniert.</span>
        </Link>
      ) : (
        <div className="home-grid">
          {active.slice(0, 3).map((v) => (
            <Link key={v.goal.id} to="/goals" className="goal-link">
              <GoalCard view={v} compact />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
