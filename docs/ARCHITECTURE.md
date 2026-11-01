# Architektur

## Überblick

```
┌────────────────────────┐        HTTPS/JSON         ┌──────────────────────────────┐
│ web (React, Vite)      │ ◄───────────────────────► │ backend (Hono, node:sqlite)  │
│                        │   /auth, /me             │                              │
│  Chat · Wortschatz ·   │   /sync/push, /changes   │  Auth (Sessions, scrypt)     │
│  Lernen · Entdecken    │   /dictionary/*          │  Sync-Log (Last-Write-Wins)  │
│                        │                          │  Wörterbuch (read-only)      │
│  TanStack DB           │                          └──────────────┬───────────────┘
│   ▲ Collections        │                                         │
│   │                    │                          ┌──────────────▼───────────────┐
│  LocalStore (Speicher) │                          │ data/vochat.db (SQLite, WAL) │
│   │ Outbox + Cursor    │                          │  users, sessions, sync_rows  │
│  IndexedDB (je Nutzer) │                          │  lexemes, senses, examples…  │
└────────────────────────┘                          └──────────────────────────────┘
```

## Local-first

- Die UI liest und schreibt **nur** den lokalen Speicher (IndexedDB) über TanStack-DB-Collections.
- Jede lokale Änderung landet sofort in der Collection und in einer **Outbox**. Die Sync-Engine schickt die Outbox
  an `/sync/push`, sobald eine Verbindung besteht (Trigger: Änderung, Online-Ereignis, alle 20 s).
- Serverstände kommen über `/sync/changes?since=<cursor>` und werden paginiert eingespielt.
- Konflikte: **Last-Write-Wins pro Zeile** anhand `updatedAt`. Lokal ausstehende, neuere Änderungen gewinnen beim Einmischen.
- Die Sitzung funktioniert offline: Token und Profil werden gecacht. Beim Abmelden mit ausstehenden Änderungen
  wird vorher gewarnt; danach werden die lokalen Daten dieses Nutzers gelöscht.
- Wörterbuch-Abfragen sind bewusst **online** (der Gesamtbestand ist zu groß für jedes Gerät). Lernkarten, die
  man aus dem Wörterbuch übernimmt, enthalten Lemma, Bedeutung und Niveau selbst, damit sie offline funktionieren.

## Optionales Konto

- Ohne Konto ist alles nutzbar: Wortschatz, Lernen, Lernpfade, eigene Sammlungen. Die Daten liegen auf dem Gerät.
- Mit Konto startet die Sync-Engine. Beim Verbinden werden alle lokalen Zeilen in die Outbox gelegt und hochgeladen.
- Öffentliche Endpunkte (`/dictionary/*`, `/catalog/*`) brauchen kein Konto. Schreiben, Bewerten und Synchronisieren braucht ein Bearer-Token.
- Der Pull-Cursor gehört zu einem Konto (`meta/cursor/<konto>`), damit Konten auf demselben Gerät sich nicht vermischen.
- Abmelden trennt nur die Synchronisation; lokale Daten bleiben erhalten.

## Katalog (öffentlich)

| Endpunkt | Zweck |
|---|---|
| `GET /catalog/paths?lang=` | Empfohlene Lernpfade (je CEFR-Niveau und „Top 500“), berechnet aus dem Wörterbuch |
| `GET /catalog/paths/:id` | Wörter eines Pfades |
| `GET /catalog/collections?kind&mediaType&lang&q&sort` | Öffentlich geteilte Medien-Sammlungen |
| `GET /catalog/collections/:id` | Eine Sammlung mit Wörtern und Bewertung |
| `PUT /catalog/collections/:id/rating` | Schwierigkeit 1–5 bewerten (Konto nötig, eine Bewertung pro Nutzer) |

Geteilt wird über das Feld `visibility: "public"` der Sammlung: Die Zeile wird normal synchronisiert, und der Katalog
zeigt nur öffentliche Zeilen. Eine Moderation gibt es noch nicht.

## Lernen: Gedächtnismodell und Planer

Der Kern liegt in `packages/shared/src/` (reine Funktionen, Client und Server rechnen identisch):

### Gedächtnismodell (`memory.ts`)

Basis ist **FSRS-5** (Free Spaced Repetition Scheduler, offene Standardgewichte). Jede Karte hat

- **Stabilität S** (Tage): nach S Tagen weiß man das Wort noch mit 90 % Wahrscheinlichkeit;
- **Schwierigkeit D** (1–10): bremst den Zuwachs; steigt nach Fehlern, sinkt nach leichten Antworten;
- **Erinnerung R(t) = (1 + 19/81 · t/S)^−0,5** (Potenzgesetz des Vergessens).

Eine richtige Antwort vergrößert S umso stärker, je kleiner R zum Zeitpunkt der Antwort war – **der zeitliche Abstand
geht also direkt ein**. Für Antworten am selben Tag nutzt FSRS-5 einen pauschalen Faktor; wir gewichten ihn zusätzlich
mit dem seither eingetretenen Vergessen (φ = (1−R)/0,1, begrenzt auf [0, 1]). Ergebnis (getestet):

| Situation | Zuwachs der Stabilität |
|---|---|
| richtig 5 s nach einem Fehler | ≈ ×1,0 („kaum Zuwachs“) |
| richtig nach einer Woche Pause | > ×2 („starker Zuwachs“) |
| falsch nach langer Pause | S schrumpft (Vergessen), D steigt |

Grundlage ist immer die **vollständige Historie** (`replay`): Der Zeitplan wird nach jeder Antwort aus allen Antworten der
Karte neu berechnet. So sind Offline-Antworten mehrerer Geräte nach dem Sync konsistent, und jeder Schritt ist erklärbar.
Bewertungen: Karteikarte/Umdrehen per Knopf (nochmal/schwer/gut/leicht, mit Vorschau des nächsten Abstands); Tippen:
richtig = gut (über 20 s = schwer), Tippfehler = schwer, falsch = nochmal. Die Antwortzeit wird mitprotokolliert.

**Fälligkeit:** wenn R unter die Zielquote fällt (Standard 90 %, einstellbar 80–97 %, je Karte „öfter“ 95 % / „seltener“
80 %). Nach einem Fehler kommt die Karte nach 10 Minuten noch einmal. Ab 3 Tagen Abstand ±5 % deterministische Streuung,
damit nicht alles auf denselben Tag fällt.

### Planer (`planner.ts`)

1. **Festigen:** zuletzt falsch beantwortete oder ganz frische Karten (Stabilität < 1 Tag).
2. **Wiederholen:** fällige Karten nach Dringlichkeit (Zielquote − aktuelle Erinnerung) – am ehesten Vergessenes zuerst.
3. **Neu:** nach Wichtigkeit – Häufigkeitsrang (logarithmisch), Niveau passend zum Ziel (über dem Ziel abgewertet),
   Herkunft (laufende Challenge > eigene Sammlung > selbst gefunden in Chat/Scan), vom Nutzer vorgezogen.
   Begrenzt durch „neue Wörter pro Tag“; ab der Hälfte von „max. Wiederholungen“ schrittweise reduziert, darüber keine neuen.
4. Neue Karten werden an jeder vierten Stelle eingemischt. Jede Karte trägt lesbare Gründe („warum?“ beim Lernen).

### Statistik (`stats.ts`) und Transparenz

- Echte Behaltensquote (nur Antworten nach ≥ 1 Tag Pause) gegenüber der Zielquote; Antworten am selben Tag separat.
- **Kalibrierung:** vorhergesagte vs. tatsächliche Trefferquote je Bereich – zeigt ehrlich, ob das Modell zur Person passt.
- Vorschau der Fälligkeiten (14 Tage), Verlauf (30 Tage), Serie, sicher/gefährdet.
- Je Karte (Wortschatz → Bearbeiten): Erinnerung jetzt, Stabilität, Schwierigkeit, nächste Wiederholung und eine Tabelle
  aller Antworten mit Pause, Erinnerung vorher und Wirkung (S vorher → nachher, Faktor).

### Eigene Entscheidungen

Ignorieren (nie abfragen), „kenne ich schon“ (als manuelle Antwort protokolliert, zählt nicht in die Behaltensquote),
als Nächstes lernen, öfter/seltener wiederholen, Fortschritt zurücksetzen (alte Antworten bleiben sichtbar, zählen nicht).
Einstellungen: Zielquote, neue Wörter pro Tag, Größe des Lernblocks, Grenze für Wiederholungen.

### Weiteres

- Tippprüfung (`typing.ts`): Damerau-Levenshtein nach Normalisierung; erlaubt sind `floor(Länge / 10)` Fehler.
- Abgleich mit Medien (`coverage.ts`): bekannt = Status „review“ oder „mastered“, in Arbeit = „new“/„learning“.
- Bestehende Karten werden beim ersten Start aus ihrer Historie auf das neue Modell umgerechnet.
- Mögliche nächste Stufe: FSRS-Gewichte je Nutzer optimieren, sobald genug Historie vorliegt (≥ 1000 Antworten);
  die Kalibrierungstabelle zeigt, ob das nötig ist.

## Startseite

Heute je Lernsprache (Wiederholungen, neue Wörter, geschätzte Minuten, „Lernblock starten“), Serie, laufende Challenges mit
Platz und Punkten, Einladungen zum Annehmen sowie Neuigkeiten (`GET /notifications`): Freundschafts- und Folgeanfragen,
neue Follower, Challenge-Einladungen, Antworten auf Kommentare, Kommentare und Entscheidungen zu eigenen Vorschlägen.
„Gelesen“ merkt sich das Gerät.

## Eigene Aufnahmen

Im Wortdetail und im Lernstand einer Karte: „einsprechen“ nimmt höchstens 5 s auf (Mono, Rauschunterdrückung, Opus mit
32 kbit/s ≈ 20 KB; Safari: AAC). Vor dem Speichern anhören oder verwerfen. Der Server nimmt bis 256 KB an, prüft das Format
anhand der Datei (WebM, Ogg, MP4/M4A, WAV, MP3), erlaubt eine Aufnahme je Person und Wort (neue ersetzt alte) und 40 pro Tag.
Aufnahmen von Experten sind sofort sichtbar, andere nach Freigabe (Expertenseite → Filter „Aufnahmen“); bis dahin hört sie nur
die Sprecherin/der Sprecher. Gespeichert im Medien-Speicher (`MEDIA_DRIVER=local` oder `s3`) unter zufälligem Namen;
ohne Medien-Speicher ist das Einsprechen ausgeblendet. Lizenz der Beiträge: CC BY-SA 4.0.

## Sync-Protokoll

| Endpunkt | Zweck |
|---|---|
| `POST /sync/push` `{ops: [{entity, row}]}` | Zeilen speichern; Antwort: `accepted`, `rejected[]` |
| `GET /sync/changes?since=N&limit=500` | Zeilen mit Sequenz > N; Antwort: `changes`, `cursor`, `hasMore` |

- `entity` ∈ `cards`, `messages`, `reviews`, `collections`. Löschen ist ein Tombstone (`deleted: true`), damit LWW auch für Löschungen gilt.
- Der Server vergibt pro angenommener Zeile eine globale Sequenznummer (`counters.seq`). Der Cursor ist die höchste
  gesehene Nummer; damit funktioniert der Pull inkrementell ohne Zeitstempel-Probleme.
- Zeilen werden mit Zod validiert; ungültige Zeilen werden einzeln abgelehnt, der Rest des Batches läuft weiter.

## Datenmodell (Kurzfassung)

Wörterbuch (global, read-only für Nutzer):

- `lexemes(lang, lemma, pos, gender, cefr, romanization, frequency_rank, frequency_count)`
- `senses(lexeme_id, position, gloss_lang, gloss, source)` – Bedeutungen je Sprache der Erklärung
- `examples(lexeme_id, text, translation, translation_lang, source)` – Beispielsätze
- `translations(lexeme_id, target_lang, target_lemma, source)` – Übersetzungen in Zielsprachen
- `categories(name, kind)` + `lexeme_categories` – Themen, Niveaus, Kategorien
- `import_runs` – Protokoll der Importe

Nutzer (synchronisiert bzw. serverseitig):

- `users`, `user_learn_langs(lang, target_cefr)`, `sessions` (Token nur als SHA-256-Hash gespeichert)
- `sync_rows(user_id, entity, id, data JSON, updated_at, deleted, seq)` – generischer Speicher für `cards` und `messages`

Lernkarte (`cards`): Lemma, Sprache, optional Verweis auf das Lexem, Bedeutung, Notiz, Niveau, Status und
SRS-Werte (Ease, Intervall, Fälligkeit). Die SRS-Logik (`packages/shared/src/srs.ts`) läuft identisch auf Client und Server.

## Mehrsprachigkeit

- Jeder Nutzer hat eine **Muttersprache** (`nativeLang`) und beliebig viele **Lernsprachen** mit Ziel-Niveau.
- Die Wörterbuch-Antworten liefern Bedeutungen bevorzugt in der Muttersprache (`senses.gloss_lang`), sonst auf Englisch.
- Neue Sprachen: Eintrag in `packages/shared/src/languages.ts`, dann Importdaten laden. Die DB-Struktur braucht keine Änderung.

## Foto → Text → Vokabeln (OCR)

Umgesetzt im Browser, ohne Server-Upload (Seite `/scan`, Kamera-Symbol oben rechts):

1. Foto aufnehmen oder wählen; große Bilder werden auf 2400 px verkleinert.
2. Texterkennung mit Tesseract.js 7 (LSTM, WASM). Worker, Kern und Sprachdaten (`deu`, `eng`, `spa`, `fas`, `jpn`,
   Modell `4.0.0_best_int`) liegen unter `web/public/tesseract` – kopiert von `web/scripts/copy-ocr-assets.mjs`
   bei `npm run dev`/`build`. Kein CDN, funktioniert offline; geladen wird nur, wenn jemand scannt (~2–4 MB je Sprache).
3. Der erkannte Text ist editierbar und wird dann über `POST /dictionary/extract` ausgewertet: bekannte Wörter
   (eigene Karten), neue Wörterbuch-Wörter (nach Häufigkeit) und Wörter ohne Eintrag. Offline wird nur mit der
   eigenen Sammlung verglichen.
4. Neue Wörter mit einem Tipp lernen oder als (private) Sammlung „Buch“ speichern. Foto und Text werden nie gespeichert.

### Grammatische Varianten („ich esse“ / „ich aß“)

Der Wortschlüssel (`lemma_key`) normalisiert Schreibung (Groß/Klein, persische Varianten, Harakat, ZWNJ). Zusätzlich
gibt es `lexeme_forms`: jede bekannte gebeugte Form zeigt auf ihr Lexem. Quellen: Wiktionary/kaikki (`forms`, vollständige
Konjugations- und Deklinationstabellen) und wordhoard (Top 2000 de/en/es). Bei der Auswertung wird zuerst das Lemma,
dann die Form gesucht; „esse“, „isst“, „aß“, „gegessen“ landen alle bei **essen**. Die Antwort enthält `forms`
(Lexem-ID → Formen im Text), die Scan-Seite zeigt sie als „im Text: aß, gegessen“.

Grenzen: Ohne kaikki-Import kennen nur die häufigsten Wörter ihre Formen. Trennbare Verben („ich fange … an“) werden
nicht zusammengesetzt. Japanisch wird mit `Intl.Segmenter` in Wörter getrennt, Beugungen (食べました → 食べる) werden
erst mit einem Morphologie-Analysator (z. B. kuromoji) aufgelöst – geplant.

## Aussprache-Audio

Reihenfolge beim Tippen auf 🔊 (`web/src/lib/audio.ts`):

1. **Aufnahme** echter Sprecher aus Lingua Libre / Wikimedia Commons (meist CC BY-SA 4.0). Gespeichert wird nur der
   Link mit Lizenz und Sprecher (`lexeme_audio`), abgespielt direkt von `upload.wikimedia.org` (MP3-Transcode, läuft
   auch auf iOS). Import: über kaikki (`sounds`) oder `npm run import:dictionary -w backend -- commons-audio --lang de`.
2. **Gerätestimme** (Web Speech API) – offline, auf Handys meist sehr gut.
3. **Erzeugt** mit eSpeak NG (GPL-3, Emscripten-Build, keine Systempakete): `GET /audio/tts?lang=&text=[&slow=1]`
   liefert WAV, wird im Speicher und unter `TTS_CACHE_DIR` gecacht und ist unbegrenzt cachebar.

`GET /audio/ipa` erzeugt eine IPA-Umschrift; die Wortanzeige nutzt sie (mit `*` markiert), wenn bei Persisch oder
Japanisch keine geprüfte Aussprache existiert. Rechtsklick auf 🔊 spielt langsam ab. Einstellungen im Profil:
Knopf an/aus, Stimme (automatisch / nur Gerät / nur erzeugt), Autoplay beim Lernen.

## Gemeinsames Lernen

- **Arbeitsbuch an Freunde** (`POST /challenges`): Wortliste aus einer eigenen Sammlung, 1 Freund = Duell, mehrere = Gruppe,
  Laufzeit 3–30 Tage. Eingeladene nehmen an oder lehnen ab.
- **Wochen-Challenge** je Sprache: 25 Wörter, rotierend aus den häufigsten Wörtern, Montag bis Sonntag (UTC), offen für alle.
- **Rangliste** serverseitig aus den synchronisierten Karten und Lernereignissen (abgeleitete Spalten `ref_key`/`ref_id`/`attr`
  in `sync_rows`): bekannte Wörter × 10 + richtige Antworten im Zeitraum. Namen in Wochen-Challenges nur für Freunde/öffentlich.

## Expertenprüfung, Verlauf und Punkte

- Jedes Lexem gilt als **ungeprüft**, bis ein Experte der Sprache (oder Admin) es prüft – auch importierte Standarddaten.
- Seite „Experten“ (Community): Filter offen / verdächtig / mit Fehler / geprüft; Aussprache setzen, Bedeutungen korrigieren,
  ergänzen, entfernen, Übersetzungen ergänzen/entfernen, als geprüft markieren oder Fehler melden.
- **Verdachts-Weitergabe:** Wird eine Bedeutung korrigiert/entfernt, werden andere Einträge mit derselben Glosse markiert;
  wird eine Übersetzung ergänzt/entfernt, alle Lexeme mit derselben Übersetzung. Sie stehen dann oben in der Warteschlange.
- **Verlauf** (`audit_log`): jede Aktion mit Wer/Wann/Was (alt → neu), öffentlich je Wort abrufbar.
- **Kommentare** als Baum mit Auf-/Abwertung an Beiträgen, Wörtern, Sammlungen und Challenges – so lässt sich auch eine
  Bewertung bewerten und diskutieren.
- **Punkte:** verifizierte Beiträge × 10 − abgelehnte × 2 + passende Stimmen × 2 − unpassende + Kommentar-Bewertungen
  + Expertenaktionen.

## Performance

- SQLite im WAL-Modus, Präfix-Suche über den Index `(lang, lemma COLLATE NOCASE)`, Ränge vorberechnet.
- Pro Sitzung nur fällige/ausgewählte Karten im Speicher; Persistenz schreibt gebündelt (150 ms) und zeilenweise.
- Offene Punkte: Code-Splitting der Web-App (Bundle ca. 650 kB unkomprimiert), virtuelle Liste im Wortschatz ab
  einigen tausend Karten, Caching der Wörterbuchabfragen im Client.

## Community & Rollen

Das Wörterbuch wächst durch Beiträge der Community. Ein Beitrag erscheint erst, wenn er verifiziert ist.

| Rolle | Rechte |
|---|---|
| Nutzer (mit Konto) | Beiträge vorschlagen (max. 30 offen), abstimmen |
| Experte (je Sprache) | verbindlich verifizieren oder ablehnen, Beiträge der Sprache widerrufen |
| Admin | alles, Experten ernennen; vergeben vom Betreiber per Kommando (`npm run admin:grant`), nie automatisch |

Beitragsarten: neues Wort, Bedeutung, Beispielsatz, Übersetzung, Widerruf (Ausblenden fehlerhafter Angaben).

Abstimmung: Experten entscheiden sofort. Sonst entscheiden übereinstimmende Stimmen (Standard 3 Richtig bzw. 3 Falsch,
per `COMMUNITY_VERIFY_THRESHOLD` / `COMMUNITY_REJECT_THRESHOLD`). Eigene Beiträge kann man nicht bewerten.

Nichts wird gelöscht: Angewandte Zeilen tragen die Quelle `community:<id>` und lassen sich per Admin-Widerruf
ausblenden (`hidden = 1`). Alle Wörterbuchabfragen filtern ausgeblendete Zeilen heraus.

Community-Schreibvorgänge sind online-only, weil der gemeinsame Bestand zentral entschieden wird.

## Profile, Medien und Social

**Profile:** Name, Bio, Profilbild, Muttersprache und Lernsprachen. Zwei Schalter steuern die Sichtbarkeit:
`profilePublic` (auffindbar, ohne Zustimmung folgbar) und `showProgress` (Lernfortschritt für Freunde).

**Medien-Dienst** (`backend/src/media.ts`): Dateien liegen hinter einer Schnittstelle `MediaStore` mit drei Treibern.

| `MEDIA_DRIVER` | Wirkung |
|---|---|
| `none` (Standard) | Kein Upload. Die App zeigt einen Hinweis, Initialen dienen als Platzhalter. |
| `local` | Dateien in `MEDIA_LOCAL_DIR` (Standard `data/media`). Für Entwicklung. |
| `s3` | S3-kompatibler Bucket (AWS S3, R2, MinIO). Braucht `MEDIA_S3_BUCKET`, optional `MEDIA_S3_REGION` und `MEDIA_S3_ENDPOINT`, dazu `npm install @aws-sdk/client-s3 -w backend`. |

Avatare: PNG, JPEG oder WebP, max. 2 MB. Der Typ wird aus den Dateikennung-Bytes erkannt, nicht aus dem Header.
Ausgeliefert werden sie über `/media/avatars/:userId` (sichtbar, wenn das Profil öffentlich ist oder man folgt).

Der S3-Treiber ist geschrieben, aber **noch nicht gegen einen echten Bucket getestet**.

**Follow:** öffentliche Profile sofort, private nach Zustimmung (`requested` → `accepted`).

**Freundschaft:** gegenseitig. Wer zuerst fragt, wartet; fragt die andere Seite zurück, entsteht die Freundschaft.

**Sichtbarkeit:** Private Profile erscheinen nicht in der Suche. Bio, Statistik und Sammlungen sieht man nur mit Follow-Beziehung.
Lernfortschritt sieht nur, wer befreundet ist und dessen `showProgress` aktiv ist.

**Feed:** neueste öffentliche Sammlungen und verifizierte Beiträge von Freunden und Gefolgten.

Endpunkte: `/social/users`, `/social/follow/:id`, `/social/follow-requests/:id/:action`, `/social/friends/...`,
`/social/requests`, `/social/feed`, `/users/:id`, `/me/avatar`, `/media/avatars/:userId`, `/features`.

## Datenbank

Eine asynchrone Schnittstelle (`backend/src/db/`) mit drei Treibern:

| Ziel | Treiber | Einsatz |
|---|---|---|
| `postgres://…` | `pg` (Pool) | Produktion, Docker |
| `pglite:[pfad]` | PGlite (Postgres in WebAssembly) | Tests, Entwicklung ohne Server |
| Dateipfad | `node:sqlite` | Einzelplatz, Entwicklung |

Regeln für portables SQL: `?`-Platzhalter (für Postgres in `$n` umgewandelt), keine benannten Parameter,
keine `COLLATE NOCASE`, keine JSON-Funktionen in Abfragen, camelCase-Aliase vermeiden (Postgres schreibt
unquotierte Namen klein). Zeitstempel sind Millisekunden (`BIGINT`). Migrationen liegen je Dialekt in
`backend/migrations/` und laufen beim Start. Die Tests laufen gegen SQLite und Postgres (`npm test`).

**Wortschlüssel (`lemma_key`):** normalisierte Schreibung eines Lemmas (klein, persische/arabische Varianten
vereinheitlicht, ohne Diakritika und Null-Breite-Zeichen). Suche, Formen-Abgleich und das Verknüpfen eigener
Vokabeln laufen darüber. **Formen (`lexeme_forms`):** gebeugte Formen aus wordhoard und kaikki, damit die
Extraktion aus Texten auch „ist“ → „sein“ erkennt.

## Eigene Vokabeln und Wörterbuch

Jede Karte trägt zwei Referenzen:

1. **Lexem-ID** (`lexemeId`): präzise Verknüpfung mit einem Wörterbucheintrag (unterscheidet z. B. Nomen und Verb).
2. **Wortschlüssel**: Sprache + normalisierte Schreibung (`lemmaKey`). Fehlt die ID, ist das Wort selbst die Referenz.

Felder, die der Nutzer selbst ändert, stehen in `custom` und werden nie vom Wörterbuch überschrieben.
Alle anderen Felder folgen dem Wörterbuch. Ergänzt die Community z. B. eine Aussprache, erscheint sie automatisch
auf den Karten. Ein Feld lässt sich jederzeit auf den Wörterbuchwert zurücksetzen.

**Automatischer Abgleich** (`web/src/lib/linker.ts`): beim Start, beim Online-Werden, bei neuen Karten oder
Sammlungen (gedrosselt auf alle 10 Minuten) und auf Knopfdruck im Wortschatz.

1. Unverknüpfte Karten und Sammlungswörter werden gesammelt über `POST /dictionary/resolve` aufgelöst
   (Wortschlüssel, sonst bekannte gebeugte Form) und verknüpft.
2. Verknüpfte Karten holen über `POST /dictionary/lexemes/batch` neue Werte für alle nicht eigenen Felder.
3. Geschrieben wird nur bei echten Änderungen.

**Aufstieg ins Wörterbuch:** Ein eigenes Wort ohne Eintrag lässt sich direkt aus der Karte als Community-Beitrag
„Neues Wort“ vorschlagen (mit Bedeutung und Aussprache). Nach der Verifizierung verknüpfen sich beim nächsten
Abgleich die passenden Karten und Sammlungswörter aller Nutzer automatisch, weil sie über den Wortschlüssel
gefunden werden. Eigene Bedeutungen oder Aussprachen verknüpfter Karten lassen sich ebenso vorschlagen.

**Medien und Lieder:** Beim Anlegen einer Sammlung kann ein Text (z. B. ein Liedtext, den man besitzt) eingefügt
werden. Übernommen werden nur die vorkommenden Wörter; der Text selbst wird verworfen und nie gespeichert oder
geteilt. Wörter ohne Wörterbucheintrag bleiben in der Liste und verknüpfen sich später automatisch. Der Abgleich
„wie viele Wörter kenne ich schon“ läuft über Lexem-ID und Wortschlüssel.

**Lokale Daten und Konten:** Der Gerätespeicher merkt sich, welchem Konto die Daten gehören. Anonyme Daten werden
beim ersten Login übernommen; Daten eines anderen Kontos werden verworfen statt hochgeladen. Beim Abmelden kann
man die lokalen Daten löschen (empfohlen auf geteilten Geräten).
