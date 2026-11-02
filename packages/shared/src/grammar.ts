/**
 * Wortformen (Konjugation, Deklination, Steigerung) und Wortbeziehungen.
 *
 * Quellen liefern grammatische Angaben unterschiedlich: wordhoard kurz („pres.3sg“, „part.perf“),
 * Wiktionary/kaikki ausgeschrieben („present“, „third-person“, „singular“). Beides wird auf
 * einheitliche Tags gebracht, gespeichert als Text mit Leerzeichen, und für die Anzeige gruppiert.
 */

export const FORM_TAGS = [
  // Zeit
  "present", "past", "imperfect", "perfect", "pluperfect", "future", "future-perfect",
  // Modus
  "indicative", "subjunctive", "imperative", "conditional",
  // Person & Zahl
  "first-person", "second-person", "third-person", "singular", "plural",
  // Infinite Formen
  "infinitive", "participle", "gerund",
  // Fall
  "nominative", "genitive", "dative", "accusative",
  // Steigerung
  "comparative", "superlative",
  // Genus & Bestimmtheit
  "masculine", "feminine", "neuter", "definite", "indefinite",
  // Höflichkeit/Verneinung (z. B. Japanisch, Persisch)
  "formal", "informal", "polite", "negative",
] as const;
export type FormTag = (typeof FORM_TAGS)[number];

const KNOWN = new Set<string>(FORM_TAGS);

/** Abweichende Schreibweisen aus Wiktionary auf einheitliche Tags. */
const ALIASES: Record<string, FormTag> = {
  preterite: "past",
  "simple-past": "past",
  "past-tense": "past",
  "present-tense": "present",
  "future-i": "future",
  "future-ii": "future-perfect",
  "subjunctive-i": "subjunctive",
  "subjunctive-ii": "subjunctive",
  "conditional-mood": "conditional",
  "first-person-singular": "first-person",
  "verbal-noun": "gerund",
  "present-participle": "participle",
  "past-participle": "participle",
};

/** Kurzschreibweise aus wordhoard (Punkt-getrennt). */
const SHORT: Record<string, FormTag[]> = {
  pres: ["present"],
  past: ["past"],
  impf: ["imperfect"],
  perf: ["perfect"],
  fut: ["future"],
  cond: ["conditional"],
  subj: ["subjunctive"],
  imp: ["imperative"],
  inf: ["infinitive"],
  part: ["participle"],
  ger: ["gerund"],
  nom: ["nominative"],
  gen: ["genitive"],
  dat: ["dative"],
  acc: ["accusative"],
  comp: ["comparative"],
  sup: ["superlative"],
  sg: ["singular"],
  pl: ["plural"],
  m: ["masculine"],
  f: ["feminine"],
  n: ["neuter"],
};
const PERSON: Record<string, FormTag> = { "1": "first-person", "2": "second-person", "3": "third-person" };

/** Ausgeschriebene Tags (kaikki) vereinheitlichen; unbekannte werden verworfen. */
export function normalizeFormTags(raw: readonly string[]): FormTag[] {
  const out = new Set<FormTag>();
  for (const t of raw) {
    const tag = t.trim().toLowerCase();
    const mapped = ALIASES[tag] ?? (KNOWN.has(tag) ? (tag as FormTag) : null);
    if (mapped) out.add(mapped);
    if (tag === "past-participle") out.add("past");
    if (tag === "present-participle") out.add("present");
  }
  return sortTags([...out]);
}

/** Kurzschreibweise wie „pres.3sg“, „subj.impf.1pl“, „part.perf“; „surface“ = Form ohne Angabe. */
export function parseShortTags(short: string): FormTag[] {
  const out = new Set<FormTag>();
  for (const part of short.trim().toLowerCase().split(".")) {
    if (!part || part === "surface") continue;
    const person = /^([123])(sg|pl)$/.exec(part);
    if (person) {
      out.add(PERSON[person[1]!]!);
      out.add(person[2] === "sg" ? "singular" : "plural");
      continue;
    }
    // „part.perf“ ist das Partizip Perfekt (Vergangenheit), „part.pres“ das Partizip Präsens.
    for (const tag of SHORT[part] ?? []) out.add(tag);
  }
  return sortTags([...out]);
}

const ORDER = new Map<string, number>(FORM_TAGS.map((t, i) => [t, i]));
const sortTags = (tags: FormTag[]) => tags.sort((a, b) => ORDER.get(a)! - ORDER.get(b)!);

/** Gespeicherte Form: „sieht“ mit „present third-person singular“. */
export const serializeTags = (tags: readonly string[]) => tags.join(" ");
export const parseTags = (stored: string): FormTag[] => normalizeFormTags(stored.split(/\s+/).filter(Boolean));

// ---- Anzeige ---------------------------------------------------------------

const TENSE_LABEL: Partial<Record<FormTag, string>> = {
  present: "Präsens",
  past: "Präteritum",
  imperfect: "Imperfekt",
  perfect: "Perfekt",
  pluperfect: "Plusquamperfekt",
  future: "Futur",
  "future-perfect": "Futur II",
};
const MOOD_LABEL: Partial<Record<FormTag, string>> = {
  subjunctive: "Konjunktiv",
  imperative: "Imperativ",
  conditional: "Konditional",
};
const CASE_LABEL: Partial<Record<FormTag, string>> = {
  nominative: "Nominativ",
  genitive: "Genitiv",
  dative: "Dativ",
  accusative: "Akkusativ",
};
const TAG_LABEL: Partial<Record<FormTag, string>> = {
  ...TENSE_LABEL,
  ...MOOD_LABEL,
  ...CASE_LABEL,
  indicative: "Indikativ",
  infinitive: "Infinitiv",
  participle: "Partizip",
  gerund: "Gerundium",
  comparative: "Komparativ",
  superlative: "Superlativ",
  singular: "Singular",
  plural: "Plural",
  masculine: "maskulin",
  feminine: "feminin",
  neuter: "neutral",
  definite: "bestimmt",
  indefinite: "unbestimmt",
  formal: "förmlich",
  informal: "vertraut",
  polite: "höflich",
  negative: "verneint",
};

/** Personalpronomen je Sprache für Konjugationstabellen (sonst „1. Sg.“ …). */
const PRONOUNS: Record<string, Record<string, string>> = {
  de: { "1s": "ich", "2s": "du", "3s": "er/sie/es", "1p": "wir", "2p": "ihr", "3p": "sie/Sie" },
  en: { "1s": "I", "2s": "you", "3s": "he/she/it", "1p": "we", "2p": "you", "3p": "they" },
  es: { "1s": "yo", "2s": "tú", "3s": "él/ella/usted", "1p": "nosotros", "2p": "vosotros", "3p": "ellos/ustedes" },
  fa: { "1s": "من", "2s": "تو", "3s": "او", "1p": "ما", "2p": "شما", "3p": "آن‌ها" },
};

function personKey(tags: Set<string>): string | null {
  const p = tags.has("first-person") ? "1" : tags.has("second-person") ? "2" : tags.has("third-person") ? "3" : null;
  if (!p) return null;
  return p + (tags.has("plural") ? "p" : "s");
}

export interface FormRow {
  /** Zeilenbeschriftung, z. B. „du“, „Nominativ Plural“, „Partizip Perfekt“. */
  label: string;
  forms: string[];
}
export interface FormGroup {
  title: string;
  rows: FormRow[];
}

const GROUP_ORDER = [
  "Präsens", "Präteritum", "Imperfekt", "Perfekt", "Plusquamperfekt", "Futur", "Futur II", "Konditional",
  "Konjunktiv Präsens", "Konjunktiv Präteritum", "Konjunktiv Imperfekt", "Konjunktiv Futur", "Konjunktiv",
  "Imperativ", "Infinite Formen", "Deklination", "Steigerung", "Formen", "Weitere Formen",
];
const ROW_ORDER = ["1s", "2s", "3s", "1p", "2p", "3p"];

/**
 * Formen für die Anzeige ordnen: Konjugation nach Zeit/Modus mit Pronomen, Deklination nach Fall,
 * Steigerung, infinite Formen; Formen ohne Angabe unter „Weitere Formen“.
 */
export function groupForms(forms: readonly { form: string; tags: readonly string[] }[], lang: string): FormGroup[] {
  const groups = new Map<string, Map<string, { order: number; forms: string[] }>>();
  const add = (group: string, label: string, order: number, form: string) => {
    let g = groups.get(group);
    if (!g) groups.set(group, (g = new Map()));
    const row = g.get(label) ?? { order, forms: [] };
    if (!row.forms.includes(form)) row.forms.push(form);
    g.set(label, row);
  };

  for (const f of forms) {
    const tags = new Set<string>(f.tags);
    const label = (list: FormTag[]) => list.filter((t) => tags.has(t)).map((t) => TAG_LABEL[t]).join(" ");
    const pk = personKey(tags);
    const tense = (Object.keys(TENSE_LABEL) as FormTag[]).find((t) => tags.has(t));
    const mood = (Object.keys(MOOD_LABEL) as FormTag[]).find((t) => tags.has(t));
    const kase = (Object.keys(CASE_LABEL) as FormTag[]).find((t) => tags.has(t));

    if (tags.has("participle") || tags.has("gerund") || tags.has("infinitive")) {
      const kind = tags.has("gerund") ? "Gerundium" : tags.has("infinitive") ? "Infinitiv" : "Partizip";
      const when = tags.has("past") || tags.has("perfect") ? " Perfekt" : tags.has("present") ? " Präsens" : "";
      add("Infinite Formen", kind + (kind === "Partizip" ? when : ""), kind === "Infinitiv" ? 0 : kind === "Partizip" ? 1 : 2, f.form);
    } else if (tags.has("comparative") || tags.has("superlative")) {
      add("Steigerung", tags.has("comparative") ? "Komparativ" : "Superlativ", tags.has("comparative") ? 0 : 1, f.form);
    } else if (kase) {
      const num = tags.has("plural") ? "Plural" : "Singular";
      add("Deklination", `${CASE_LABEL[kase]} ${num}`, (tags.has("plural") ? 10 : 0) + ["nominative", "genitive", "dative", "accusative"].indexOf(kase), f.form);
    } else if (mood === "imperative") {
      add("Imperativ", tags.has("plural") ? (PRONOUNS[lang]?.["2p"] ?? "Plural") : (PRONOUNS[lang]?.["2s"] ?? "Singular"), tags.has("plural") ? 1 : 0, f.form);
    } else if (pk && (tense || mood)) {
      const title = mood && mood !== "conditional" ? `${MOOD_LABEL[mood]}${tense ? ` ${TENSE_LABEL[tense]}` : ""}` : mood === "conditional" ? "Konditional" : TENSE_LABEL[tense!]!;
      const row = PRONOUNS[lang]?.[pk] ?? `${pk[0]}. ${pk[1] === "s" ? "Sg." : "Pl."}`;
      add(title, row, ROW_ORDER.indexOf(pk), f.form);
    } else if (tags.size > 0 && label([...FORM_TAGS])) {
      add("Formen", label([...FORM_TAGS]), 0, f.form);
    } else {
      add("Weitere Formen", "", 0, f.form);
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => rank(a) - rank(b))
    .map(([title, rows]) => ({
      title,
      rows: [...rows.entries()].sort(([, a], [, b]) => a.order - b.order).map(([label, r]) => ({ label, forms: r.forms })),
    }));
}

const rank = (title: string) => {
  const i = GROUP_ORDER.indexOf(title);
  return i < 0 ? GROUP_ORDER.length : i;
};

// ---- Beziehungen -------------------------------------------------------------

export const RELATION_KINDS = ["synonym", "antonym", "related", "derived", "hypernym", "hyponym"] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export const RELATION_LABEL: Record<RelationKind, string> = {
  synonym: "Synonyme",
  antonym: "Gegenteil",
  related: "Verwandt",
  derived: "Abgeleitet",
  hypernym: "Oberbegriffe",
  hyponym: "Unterbegriffe",
};

/** Feldnamen in Wiktionary/kaikki je Beziehung. */
export const KAIKKI_RELATION_FIELDS: Record<RelationKind, string> = {
  synonym: "synonyms",
  antonym: "antonyms",
  related: "related",
  derived: "derived",
  hypernym: "hypernyms",
  hyponym: "hyponyms",
};
