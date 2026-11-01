import { useState } from "react";
import { isLangCode, type LangCode } from "@vochat/shared";
import { useSession } from "../session";
import { prefs } from "./prefs";

const KEY = "vochat.activeLang";

/** Aktive Lernsprache (geräteweit gemerkt). Fällt auf die erste Lernsprache zurück. */
export function useActiveLang(): [LangCode, (lang: LangCode) => void, LangCode[]] {
  const { user } = useSession();
  const learning = user.learnLangs.map((l) => l.lang);
  const stored = prefs.get(KEY);
  const [lang, setLangState] = useState<LangCode>(() => {
    if (stored && isLangCode(stored) && learning.includes(stored)) return stored;
    return learning[0] ?? "es";
  });
  const setLang = (next: LangCode) => {
    prefs.set(KEY, next);
    setLangState(next);
  };
  return [lang, setLang, learning];
}
