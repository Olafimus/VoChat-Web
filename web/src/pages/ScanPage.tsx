import { useMemo, useState } from "react";
import { useLiveQuery } from "@tanstack/react-db";
import { LANGUAGES, lemmaKey, tokenize, type Cefr, type ExtractResult, type LangCode, type LexemeSummary } from "@vochat/shared";
import { extract } from "../api/client";
import { useSession } from "../session";
import { useActiveLang } from "../lib/lang";
import { addCardFromLexeme, addOwnWord, hasCardWord } from "../lib/cards";
import { newMediaCollection } from "../lib/collections";
import { recognize } from "../lib/ocr";
import type { CardRow } from "../local/collections";
import { Empty } from "../components/ui";
import { WordView } from "../components/WordView";
import { IconScan } from "../components/icons";

const STATUS_LABEL: Record<string, string> = {
  "loading tesseract core": "Lade Texterkennung",
  "initializing tesseract": "Starte Texterkennung",
  "loading language traineddata": "Lade Sprachdaten",
  "initializing api": "Bereite vor",
  "recognizing text": "Erkenne Text",
};

interface Analysis {
  known: LexemeSummary[];
  fresh: LexemeSummary[];
  missing: string[];
  forms: Record<number, string[]>;
  offline: boolean;
}

/**
 * Foto → Vokabeln: Buchseite, Schild oder Speisekarte fotografieren, Text erkennen (auf dem Gerät),
 * Wörter mit dem Wörterbuch (inkl. gebeugter Formen) und der eigenen Sammlung abgleichen und die
 * unbekannten mit einem Tipp lernen. Weder Foto noch Text werden gespeichert – nur die Wortliste.
 */
export function ScanPage() {
  const { collections, user } = useSession();
  const [activeLang] = useActiveLang();
  const cards = (useLiveQuery(() => collections.cards).data ?? []) as CardRow[];
  const [lang, setLang] = useState<LangCode>(activeLang ?? user.learnLangs[0]?.lang ?? "en");
  const [preview, setPreview] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ status: string; value: number } | null>(null);
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const langs = user.learnLangs.length ? user.learnLangs.map((l) => l.lang as LangCode) : (Object.keys(LANGUAGES) as LangCode[]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setMsg(null);
    setAnalysis(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setProgress({ status: "Lade Texterkennung", value: 0 });
    try {
      const r = await recognize(file, lang, (status, value) => setProgress({ status: STATUS_LABEL[status] ?? status, value }));
      setText((prev) => [prev.trim(), r.text.trim()].filter(Boolean).join("\n\n"));
      setConfidence(Math.round(r.confidence));
    } catch (e) {
      setMsg(`Texterkennung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setProgress(null);
    }
  };

  const analyze = async () => {
    const tokens = tokenize(text, 2000);
    let result: ExtractResult;
    let offline = false;
    try {
      result = await extract(lang, text, user.nativeLang);
    } catch {
      // Offline: nur mit der eigenen Sammlung abgleichen.
      offline = true;
      result = { matches: [], unknown: tokens };
    }
    const known: LexemeSummary[] = [];
    const fresh: LexemeSummary[] = [];
    for (const m of result.matches) (hasCardWord(cards, lang, m.lemma, m.id) ? known : fresh).push(m);
    fresh.sort((a, b) => (a.frequencyRank ?? 1e9) - (b.frequencyRank ?? 1e9));
    const missing = result.unknown.filter((w) => !hasCardWord(cards, lang, w));
    const ownKnown = result.unknown.length - missing.length;
    setAnalysis({ known, fresh, missing, forms: result.forms ?? {}, offline });
    setSelected(new Set(fresh.map((m) => `l:${m.id}`)));
    setMsg(
      offline
        ? `Offline: ${ownKnown} Wörter kennst du schon, ${missing.length} sind neu. Mit Verbindung werden auch gebeugte Formen erkannt.`
        : null,
    );
  };

  const toggle = (key: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const learnSelected = () => {
    if (!analysis) return;
    let n = 0;
    for (const m of analysis.fresh) if (selected.has(`l:${m.id}`) && !hasCardWord(cards, lang, m.lemma, m.id)) (addCardFromLexeme(collections, m, lang, "scan"), n++);
    for (const w of analysis.missing) if (selected.has(`w:${w}`) && !hasCardWord(cards, lang, w)) (addOwnWord(collections, { lang, lemma: w, origin: "scan" }), n++);
    setMsg(`${n} Wörter zum Lernen hinzugefügt.`);
    setSelected(new Set());
  };

  const saveCollection = () => {
    if (!analysis || !title.trim()) return;
    const items: Parameters<typeof newMediaCollection>[0]["items"] = [
      ...analysis.known,
      ...analysis.fresh,
    ].map((m) => ({ lemma: m.lemma, lang, lexemeId: m.id, gloss: m.gloss, pronunciation: m.romanization, cefr: (m.cefr as Cefr | null) ?? null }));
    const seen = new Set(items.map((i) => lemmaKey(i.lemma)));
    for (const w of analysis.missing) if (!seen.has(lemmaKey(w))) items.push({ lemma: w, lang, lexemeId: null, gloss: null, pronunciation: null, cefr: null });
    const row = newMediaCollection({
      kind: "media",
      mediaType: "book",
      title: title.trim(),
      description: "Aus einem Foto erstellt (nur Wortliste).",
      lang,
      level: null,
      visibility: "private",
      ownerName: user.name,
      items,
    });
    void collections.collections.insert(row);
    setMsg(`Sammlung „${title.trim()}“ mit ${items.length} Wörtern gespeichert (unter Lernpfade).`);
    setTitle("");
  };

  const total = analysis ? analysis.known.length + analysis.fresh.length + analysis.missing.length : 0;
  const knownPct = analysis && total ? Math.round((analysis.known.length / total) * 100) : 0;
  const formsOf = (id: number) => analysis?.forms[id]?.join(", ");

  return (
    <div className="stack">
      <section className="card stack">
        <h2 className="icon-title"><IconScan size={22} aria-hidden /> Foto → Vokabeln</h2>
        <p className="muted small">
          Fotografiere eine Buchseite, ein Schild oder eine Speisekarte. Die Texterkennung läuft auf deinem Gerät; Foto und Text
          werden nicht gespeichert.
        </p>
        <div className="row">
          <label className="inline">
            Sprache des Textes
            <select value={lang} onChange={(e) => setLang(e.target.value as LangCode)}>
              {langs.map((l) => (
                <option key={l} value={l}>{LANGUAGES[l].name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <label className="button primary file-button" tabIndex={0}>
            Foto aufnehmen
            <input type="file" accept="image/*" capture="environment" onChange={(e) => void onFile(e.target.files?.[0])} hidden />
          </label>
          <label className="button file-button" tabIndex={0}>
            Bild wählen
            <input type="file" accept="image/*" onChange={(e) => void onFile(e.target.files?.[0])} hidden />
          </label>
        </div>
        {progress && (
          <div className="stack" aria-live="polite">
            <div className="pack-bar"><span style={{ width: `${Math.round(progress.value * 100)}%` }} /></div>
            <span className="muted small">{progress.status} … {Math.round(progress.value * 100)} %</span>
          </div>
        )}
        {preview && <img src={preview} alt="Aufgenommenes Foto" className="scan-preview" />}
        {lang === "ja" && (
          <p className="muted small">
            Japanisch: Wörter werden ohne Leerzeichen automatisch getrennt; gebeugte Verben (z. B. 食べました) werden noch nicht
            immer auf die Grundform zurückgeführt.
          </p>
        )}
      </section>

      <section className="card stack">
        <label>
          Erkannter Text {confidence !== null && <span className="muted small">(Sicherheit {confidence} %)</span>}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            dir={lang === "fa" ? "rtl" : undefined}
            placeholder="Text erscheint hier – du kannst ihn korrigieren oder auch direkt Text einfügen."
          />
        </label>
        <div className="row">
          <button className="primary" disabled={!text.trim()} onClick={() => void analyze()}>Wörter auswerten</button>
          <button disabled={!text} onClick={() => { setText(""); setAnalysis(null); setConfidence(null); }}>Leeren</button>
        </div>
      </section>

      {msg && <div className="muted small" role="status">{msg}</div>}

      {analysis && (
        <>
          <section className="card stack">
            <h2>Ergebnis</h2>
            <div className="pack-bar" aria-label={`${knownPct} % bekannt`}><span style={{ width: `${knownPct}%` }} /></div>
            <div className="muted small">
              {analysis.known.length} kennst du · {analysis.fresh.length} neu im Wörterbuch · {analysis.missing.length} ohne Eintrag ·{" "}
              {knownPct} % bekannt
            </div>
            <div className="row">
              <button className="primary" disabled={selected.size === 0} onClick={learnSelected}>
                {selected.size} ausgewählte lernen
              </button>
              <button onClick={() => setSelected(new Set(analysis.fresh.map((m) => `l:${m.id}`)))}>Alle neuen</button>
              <button onClick={() => setSelected(new Set())}>Keine</button>
            </div>
          </section>

          <section className="card stack">
            <h3>Neu für dich ({analysis.fresh.length})</h3>
            {analysis.fresh.length === 0 && <Empty>Keine neuen Wörterbuch-Wörter.</Empty>}
            <ul className="list">
              {analysis.fresh.map((m) => (
                <li key={m.id} className="row">
                  <input type="checkbox" checked={selected.has(`l:${m.id}`)} onChange={() => toggle(`l:${m.id}`)} aria-label={`${m.lemma} auswählen`} />
                  <WordView lexemeId={m.id} lemma={m.lemma} lang={lang} pronunciation={m.romanization} gloss={m.gloss} cefr={m.cefr} />
                  {formsOf(m.id) && <span className="muted small">im Text: {formsOf(m.id)}</span>}
                </li>
              ))}
            </ul>
          </section>

          {analysis.missing.length > 0 && (
            <section className="card stack">
              <h3>Nicht im Wörterbuch ({analysis.missing.length})</h3>
              <p className="muted small">Eigennamen, seltene Wörter oder Erkennungsfehler. Als eigene Wörter hinzufügen – sie verknüpfen sich automatisch, sobald es einen Eintrag gibt.</p>
              <div className="chips">
                {analysis.missing.map((w) => (
                  <button key={w} className={`chip ${selected.has(`w:${w}`) ? "on" : ""}`} onClick={() => toggle(`w:${w}`)}>{w}</button>
                ))}
              </div>
            </section>
          )}

          {analysis.known.length > 0 && (
            <details className="card">
              <summary>Kennst du schon ({analysis.known.length})</summary>
              <ul className="list">
                {analysis.known.map((m) => (
                  <li key={m.id}>
                    <WordView lexemeId={m.id} lemma={m.lemma} lang={lang} pronunciation={m.romanization} gloss={m.gloss} cefr={m.cefr} />
                  </li>
                ))}
              </ul>
            </details>
          )}

          <section className="card stack">
            <h3>Als Sammlung speichern</h3>
            <div className="row">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Der kleine Prinz, S. 12" style={{ flex: 1 }} aria-label="Titel der Sammlung" />
              <button disabled={!title.trim()} onClick={saveCollection}>Speichern</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
