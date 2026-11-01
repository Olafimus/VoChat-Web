import { useState } from "react";
import { CommunityPage } from "./CommunityPage";
import { SocialPage } from "./SocialPage";

/** Hub für Mitmachen (Wörterbuch) und Freunde (Social). */
export function CommunityHub() {
  const [tab, setTab] = useState<"mitmachen" | "freunde">("mitmachen");
  return (
    <div className="stack">
      <div className="segmented" role="tablist">
        <button className={tab === "mitmachen" ? "on" : ""} onClick={() => setTab("mitmachen")}>Mitmachen</button>
        <button className={tab === "freunde" ? "on" : ""} onClick={() => setTab("freunde")}>Freunde</button>
      </div>
      {tab === "mitmachen" ? <CommunityPage /> : <SocialPage />}
    </div>
  );
}
