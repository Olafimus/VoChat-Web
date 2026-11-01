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

## Lernen

- Antworten werden als `reviews` protokolliert (append-only, synchronisiert).
- Tippprüfung (`packages/shared/src/typing.ts`): Damerau-Levenshtein-Distanz nach Normalisierung; erlaubt sind
  `floor(Länge / 10)` Fehler.
- Lernpaket (`packages/shared/src/packs.ts`): Priorität aus Schwäche, Wiedereinreihung nach Wartezeit, Fälligkeit und Neuen.
- Abgleich mit Medien (`packages/shared/src/coverage.ts`): bekannt = Status „review“ oder „mastered“, in Arbeit = „new“/„learning“.

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

## Geplante Erweiterung: Bilder → Text → Vokabeln

Noch nicht implementiert. Vorgesehen ist:

1. Upload-Endpunkt `POST /ingest/images` (Bilder als Blob, Ergebnis als Job mit Status).
2. Texterkennung (OCR) und Spracherkennung pro Bild, austauschbar über ein Provider-Interface.
3. Extraktion: Wörter/Wendungen gegen das Wörterbuch abgleichen, unbekannte Wörter als Vorschläge zurückgeben.
4. Der Nutzer bestätigt im Chat, Bestätigungen werden zu Lernkarten (gleiche Sync-Pipeline).
5. Sprache (Audio): gleiche Pipeline mit Transkription statt OCR.

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
