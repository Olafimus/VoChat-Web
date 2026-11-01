# Wörterbuch-Quellen

Stand der Recherche: Die Entwicklungsumgebung hatte nur Zugriff auf `raw.githubusercontent.com`,
die npm-Registry und `api.github.com` (eingeschränkt). kaikki.org, Hugging Face, Wikimedia-Dumps,
FreeDict-Download-Server und GitHub-Release-Assets waren **nicht erreichbar**. Alles unten mit
Status „geprüft“ wurde tatsächlich geladen und importiert; „nicht erreichbar“ heißt, dass die
Quelle hier nicht lag – sie ist aber lokal mit Internetzugang nutzbar.

## Übersicht

| Sprache | Quelle | Inhalt | Status | Lizenz (zu prüfen) |
|---|---|---|---|---|
| alle | [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) (2018, OpenSubtitles) | Top-50k Häufigkeitsrang je Sprache | **geprüft, importiert** (de, en, es, fa) | Code MIT; Daten aus OpenSubtitles – Nutzungsbedingungen beachten |
| de, en, es | [natema/wordhoard](https://github.com/natema/wordhoard) – Beispiel-CSVs (Top 2000) | Lemma, Wortart, Genus, Häufigkeit, **CEFR-Schätzung** (Goethe-Anker für Deutsch) | **geprüft, importiert** | Daten CC BY-SA 4.0 |
| es → en | [freedict/fd-dictionaries](https://github.com/freedict/fd-dictionaries) `spa-eng` | 4.502 Lemmata mit englischen Übersetzungen (TEI XML) | **geprüft, importiert** | GPL-2.0+ |
| fa ↔ de | Bestehendes Repo: `FarsInGermanDictionary`-Export (`legacy-fa-de.json`) | 7.507 Vokabeln mit Aussprache, deutschen Bedeutungen, Phrasen | **geprüft, importiert** | eigene Daten des Nutzers |
| alle | [kaikki.org](https://kaikki.org) (Wiktextract, Wiktionary-Extrakt, JSONL) | Bedeutungen, **Beispielsätze mit Übersetzung**, Übersetzungen, Genus, Themen – für de, en, es, fa | **Importer fertig, Daten hier nicht erreichbar** (kaikki.org blockiert) | Wiktionary: CC BY-SA 4.0 / GFDL |
| de, en, es | [natema/wordhoard](https://github.com/natema/wordhoard) – vollständiger Datensatz (GitHub Releases, SQLite + CSV) | Alle Lemmata (~70k Deutsch), Formen, CEFR-Schätzung | **nicht erreichbar** (Release-Assets) – Importer nimmt die CSV direkt | CC BY-SA 4.0 |
| de ↔ en | FreeDict `deu-eng` / `eng-deu` | Zweisprachige Übersetzungswörterbücher | **nicht gefunden** – in `fd-dictionaries` liegen nur manuell gepflegte Wörterbücher; die generierten liegen unter download.freedict.org (nicht erreichbar) | GPL |
| fa ↔ en | FreeDict `eng-fas` / `fas-eng` | Persisch–Englisch | **nicht gefunden** (siehe oben) | GPL |
| de | GerVLPro (CEFR-Liste produktiven Wortschatzes, 4.015 Einträge) | CEFR-Niveaus | Veröffentlicht (LREC 2026), **kein Download gefunden** | prüfen |
| es | ELELex / CEFRLex Spanisch (14.290 Einträge, A1–C1) | CEFR-Niveaus, rezeptiv | Download bei UCLouvain CENTAL – **nicht erreichbar** | CC BY-NC? prüfen |
| fa | CEFR-Listen | – | **nichts gefunden** | – |

## Was das für „vollständig“ bedeutet

- **Deutsch, Englisch, Spanisch:** Häufigkeit für 50.000 Lemmata; CEFR nur für die Top-2000 (wordhoard).
  Vollständige Wörterbücher mit Beispielsätzen liefern kaikki.org-Extrakte – siehe „Nächster Schritt“.
- **Persisch:** Häufigkeit (50k), 7.507 Vokabeln mit deutscher Übersetzung und Aussprache.
  Keine CEFR-Daten, kein englischer oder spanischer Wörterbuchteil verfügbar.
- **Kategorien (A1…C2):** Derzeit nur CEFR-Schätzungen aus wordhoard (de/en/es, Top 2000).
  Die Datenstruktur erlaubt weitere Kategorien (`categories.kind`, z. B. `topic`).

## Nächster Schritt: vollständige Wiktionary-Daten lokal importieren

Auf deinem Rechner mit Internetzugang:

```bash
# JSONL pro Sprache von kaikki.org herunterladen (große Dateien, mehrere GB für Deutsch/Englisch)
# Beispiel-URL-Schema – bitte auf kaikki.org/dictionary/rawdata.html prüfen:
#   https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl
#   https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl
#   https://kaikki.org/dictionary/Persian/kaikki.org-dictionary-Persian.jsonl

cd backend
npm run import:dictionary -- kaikki --lang de --gloss-lang en --file ~/Downloads/kaikki.org-dictionary-German.jsonl
npm run import:dictionary -- kaikki --lang es --gloss-lang en --file ~/Downloads/kaikki.org-dictionary-Spanish.jsonl
npm run import:dictionary -- kaikki --lang fa --gloss-lang en --file ~/Downloads/kaikki.org-dictionary-Persian.jsonl
```

**Wichtig:** Der kaikki-Importer ist nach dem Wiktextract-Schema geschrieben (`word`, `pos`, `senses[].glosses`,
`senses[].examples[].english`, `senses[].topics`, `translations[]`), aber **noch nicht gegen einen echten Dump
getestet**, weil der hier nicht erreichbar war. Beim ersten Lauf bitte die Zahl der importierten Einträge und
ein paar Stichproben prüfen und Feldnamen anpassen, falls sie abweichen.

Der Import ist idempotent pro Quelle: ein erneuter Lauf ersetzt die Bedeutungen, Beispiele und Übersetzungen
dieser Quelle, ohne Duplikate zu erzeugen.

## Befehle

```bash
npm run import:dictionary -- starter                   # alle erreichbaren Quellen (ca. 15 s)
npm run import:dictionary -- wordhoard --lang de --file data/sources/wordhoard-de-top2000.csv
npm run import:dictionary -- frequency --lang de --url https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/de/de_50k.txt
npm run import:dictionary -- freedict --from es --to en --file pfad/spa-eng.tei
npm run import:dictionary -- legacy-fa-de --file data/sources/legacy-fa-de.json
```

Die Reihenfolge ist wichtig: Lexeme mit Wortart entstehen zuerst, Häufigkeitslisten ordnen ihnen danach Ränge zu.
Ein Lexem ohne Wortart (z. B. aus einer Häufigkeitsliste) wird vom ersten Eintrag mit Wortart übernommen, so entstehen
keine Dubletten wie `haus` neben `Haus`.

## Bekannte Lücken

- Persische Schreibvarianten: Die Suche probiert ی/ي und ک/ك. Die Häufigkeitsliste nutzt teils arabische Zeichen.
- Wortformen (Flexion, z. B. „ist“ → „sein“) werden noch nicht ausgewertet; wordhoard liefert sie in der Spalte `forms`.
- Legacy-Phrasen (`hints`) werden als Beispielsätze mit deutscher Übersetzung gespeichert, nicht als eigene Lexeme.
