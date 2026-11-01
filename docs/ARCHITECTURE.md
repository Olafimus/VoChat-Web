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

## Sync-Protokoll

| Endpunkt | Zweck |
|---|---|
| `POST /sync/push` `{ops: [{entity, row}]}` | Zeilen speichern; Antwort: `accepted`, `rejected[]` |
| `GET /sync/changes?since=N&limit=500` | Zeilen mit Sequenz > N; Antwort: `changes`, `cursor`, `hasMore` |

- `entity` ∈ `cards`, `messages`. Löschen ist ein Tombstone (`deleted: true`), damit LWW auch für Löschungen gilt.
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
