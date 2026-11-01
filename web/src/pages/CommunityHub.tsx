import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { community } from "../api/client";
import { useSession } from "../session";
import { CommunityPage } from "./CommunityPage";
import { SocialPage } from "./SocialPage";
import { ChallengesPage } from "./ChallengesPage";
import { ReviewPage } from "./ReviewPage";

type Tab = "mitmachen" | "freunde" | "challenges" | "experten";

/** Hub für Mitmachen (Wörterbuch), Freunde, Challenges und – für Experten – die Prüfung. */
export function CommunityHub() {
  const { token } = useSession();
  const [params] = useSearchParams();
  const deepChallenge = params.get("challenge");
  const deepTab = params.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(deepTab && ["mitmachen", "freunde", "challenges", "experten"].includes(deepTab) ? deepTab : "challenges");
  const [isReviewer, setReviewer] = useState(false);
  useEffect(() => {
    if (!token) return setReviewer(false);
    community
      .me(token)
      .then((me) => setReviewer(me.roles.some((r) => r.role === "admin" || r.role === "expert")))
      .catch(() => setReviewer(false));
  }, [token]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "challenges", label: "Challenges" },
    { key: "freunde", label: "Freunde" },
    { key: "mitmachen", label: "Mitmachen" },
    ...(isReviewer ? [{ key: "experten" as Tab, label: "Experten" }] : []),
  ];
  return (
    <div className="stack">
      <div className={`segmented ${tabs.length === 4 ? "four" : "three"}`} role="tablist">
        {tabs.map((t) => (
          <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      {tab === "mitmachen" && <CommunityPage />}
      {tab === "freunde" && <SocialPage />}
      {tab === "challenges" && <ChallengesPage key={deepChallenge ?? ""} initialOpen={deepChallenge} />}
      {tab === "experten" && <ReviewPage />}
    </div>
  );
}
