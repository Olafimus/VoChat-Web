# VoChat

Vokabel-Lern-App im Chat-Stil: Du schreibst Wörter, bekommst Bedeutungen, Beispiele und Niveaus,
legst sie in deine Liste und lernst sie mit Wiederholungsplan. Funktioniert offline; Änderungen werden
synchronisiert, sobald eine Verbindung besteht.

- **Sprachen:** Deutsch, Englisch, Spanisch, Persisch, Japanisch (erweiterbar)
- **Stack:** TypeScript · Backend: Hono, PostgreSQL oder SQLite · Web: React, Vite, TanStack DB, IndexedDB
- **Konto optional:** Alles funktioniert lokal ohne Anmeldung. Ein Konto braucht man nur für Synchronisation,
  das Teilen von Sammlungen und das Bewerten. Die API nutzt Bearer-Tokens (kein Cookie), damit spätere
  native Apps dieselbe API verwenden können.

## Einrichtung

Voraussetzung: Node.js ≥ 22.13 (eingebautes SQLite).

```bash
npm install
npm run import:dictionary -w backend -- starter   # Wörterbuchdaten laden (ca. 15 s, braucht Internet)
npm run dev:backend                               # API auf http://localhost:8787
npm run dev:web                                   # App auf http://localhost:5173
```

Datenbank: Ohne weitere Angabe nutzt das Backend SQLite (`backend/data/vochat.db`). Mit
`DATABASE_URL=postgres://…` läuft es gegen PostgreSQL, mit `DATABASE_URL=pglite:` gegen ein
eingebettetes Postgres (ohne Server). Das Schema wird beim Start über Migrationen
(`backend/migrations/<dialekt>/`) automatisch angelegt und aktualisiert.

> Datenbanken aus Versionen vor den Migrationen bitte einmal löschen und neu importieren.

Tests:

```bash
npm test                                          # Shared + Backend auf SQLite und auf Postgres (PGlite)
npm run build                                     # Typprüfung + Produktionsbuild der Web-App
```

## Struktur

```
packages/shared/   Sprachen, Zod-Schemata, Sync- und API-Typen, SRS-Logik (von Client und Server genutzt)
backend/           API (Auth, Sync, Wörterbuch) und Importer
  src/             app.ts (Routen), sync.ts, auth.ts, dictionary.ts, db.ts, importers/
  scripts/         import-dictionary.ts (CLI)
  data/sources/    kleine Quelldaten (wordhoard Top 2000, Farsi-Altbestand)
web/               React-App (Chat, Wortschatz, Lernen, Entdecken, Profil)
  src/local/       lokaler Speicher, Outbox, Sync-Engine, TanStack-DB-Collections
docs/              DICTIONARY_SOURCES.md (Quellen & Status), ARCHITECTURE.md (Design & Sync-Protokoll)
```

## Funktionen

- **Chat:** Wort oder Wendung eingeben, Treffer mit Bedeutungen, Beispielen und Niveau anzeigen, „+ Lernen“.
- **Lernen in drei Formaten:** Karteikarte (Wort → Bedeutung), Umdrehen (Bedeutung → Wort) und Tippen.
  Beim Tippen gilt: höchstens ein Fehler je 10 Buchstaben (kurze Wörter müssen exakt stimmen);
  Groß-/Kleinschreibung, Satzzeichen und persische Schreibvarianten werden ignoriert.
- **Lernplaner mit Gedächtnismodell (FSRS):** Wiederholung genau dann, wenn ein Wort unter deine Zielquote zu rutschen droht;
  der zeitliche Abstand jeder Antwort zählt (richtig nach einer Woche ≫ richtig 5 s nach einem Fehler). Neue Wörter nach
  Häufigkeit, Niveau und Herkunft. „Warum?“ an jeder Karte, Statistik mit Kalibrierung, eigene Entscheidungen
  (ignorieren, kenne ich, vorziehen, öfter/seltener, zurücksetzen).
- **Startseite:** heutige Lernblöcke, ungelesene Nachrichten, Korrekturen, Challenges mit Platzierung, Neuigkeiten.
- **Chats mit Freunden und Gruppen:** Text, Emojis, Bilder, Sprachnachrichten, Antworten, Reaktionen, Bearbeiten/Löschen,
  Korrekturvorschläge mit Diff, „Wörter lernen“ aus Nachrichten, Gelesen-Häkchen, Echtzeit. Virtualisiert (10 000 Nachrichten flüssig).
- **Korrekturen im Wörterbuch:** Wer ein Wort in der Sammlung hat, sieht Änderungen als Diff und entscheidet selbst
  (übernehmen/ignorieren, Lernstand behalten/zurücksetzen).
- **Als App installierbar (PWA)**, startet offline.
- **Statistik:** Heatmap, Wachstum, Stabilität, Lernzeiten, Niveaus, schwierigste Wörter, Kalibrierung.
- **Eigene Aufnahmen:** Wörter selbst einsprechen (max. 5 s, komprimiert), Freigabe durch Experten.
- **Lernpfade:** empfohlene Pfade je Sprache und CEFR-Niveau sowie „Top 500“ nach Häufigkeit.
- **Eigene Vokabeln:** eigene Wörter anlegen und jede Karte bearbeiten. Die Verknüpfung zum Wörterbuch bleibt;
  eigene Werte werden nicht überschrieben, alles andere aktualisiert sich automatisch. Fehlende Wörter lassen sich
  ins Wörterbuch vorschlagen und verknüpfen sich nach der Prüfung bei allen Nutzern automatisch.
- **Profile & Social:** Profilbild, Bio, Sichtbarkeit. Folgen (öffentlich sofort, privat mit Zustimmung),
  Freundschaften, Suche nach öffentlichen Profilen, Feed von Freunden und Gefolgten. Lernfortschritt nur für Freunde,
  und nur wenn du es freigibst.
- **Medien-Wortschatz:** eigene Sammlungen zu Büchern, Liedern, Filmen oder Serien. Beim Öffnen siehst du,
  wie viele Wörter du schon kennst und welche dir noch fehlen. Mit Konto teilbar und mit 1–5 Sternen
  nach Schwierigkeit bewertbar.

- **Foto → Vokabeln:** Buchseite fotografieren, Text wird auf dem Gerät erkannt (Tesseract), unbekannte Wörter
  werden gefunden – auch gebeugte Formen („aß“ → essen) – und lassen sich mit einem Tipp lernen.
- **Aussprache:** 🔊 überall – echte Aufnahmen (Lingua Libre/Wikimedia Commons), sonst Gerätestimme, sonst eSpeak NG.
- **Challenges:** Arbeitsbücher an Freunde schicken (Duell/Gruppe), Wochen-Challenges, Rangliste.
- **Expertenprüfung:** alles startet ungeprüft; Korrekturen ziehen ähnliche Einträge nach vorn; Verlauf, Kommentarbäume, Punkte.

## Wörterbuchquellen

Siehe [docs/DICTIONARY_SOURCES.md](docs/DICTIONARY_SOURCES.md): welche Quellen geprüft und importiert sind,
was fehlt und wie du die vollständigen Wiktionary-Daten (kaikki.org) lokal einspielst.

## Konfiguration

Medien (Profilbilder):

| Variable | Standard | Zweck |
|---|---|---|
| `MEDIA_DRIVER` | `none` | `none`, `local` oder `s3` (siehe `docs/ARCHITECTURE.md`) |
| `MEDIA_LOCAL_DIR` | `data/media` | Ordner für den lokalen Treiber |
| `MEDIA_S3_BUCKET` | – | Bucket-Name, nur für `s3` |
| `MEDIA_S3_REGION` | `auto` | Region des Buckets |
| `MEDIA_S3_ENDPOINT` | – | Für S3-kompatible Dienste (R2, MinIO) |

Rollen (Admin, Experte je Sprache) vergibt der Betreiber per Kommando:
`npm run admin:grant -w backend -- --email ich@example.com --role admin` bzw. `--role expert --lang fa`.

Zusätzlich für die Community:

| Variable | Standard | Zweck |
|---|---|---|
| `APP_SECRET` | wird erzeugt | Geheimnis für signierte Links (Avatare). Ohne Angabe einmalig erzeugt und in der DB gespeichert |
| `COMMUNITY_VERIFY_THRESHOLD` | `3` | Übereinstimmende Stimmen, damit ein Beitrag verifiziert ist |
| `COMMUNITY_REJECT_THRESHOLD` | `3` | Übereinstimmende Stimmen, damit ein Beitrag abgelehnt ist |

**Hinweis:** Nach dem Community-Update fehlen in einer bestehenden `vochat.db` die neuen Spalten (`hidden`).
Datenbank löschen und `starter` erneut ausführen.


| Variable | Standard | Zweck |
|---|---|---|
| `PORT` | `8787` | Port der API |
| `DATABASE_URL` | – | `postgres://…` (Postgres), `pglite:[pfad]` (eingebettet); leer = SQLite |
| `DB_PATH` | `data/vochat.db` | SQLite-Datei, wenn `DATABASE_URL` leer ist |
| `TRUST_PROXY` | – | `1` hinter einem Proxy (nginx): Client-IP aus `X-Real-IP` für die Ratenbegrenzung |
| `CORS_ORIGINS` | `http://localhost:5173` | Erlaubte Web-Origins (kommagetrennt) |
| `VITE_BACKEND_URL` | `http://localhost:8787` | Ziel des Dev-Proxys `/api` |
| `VITE_API_URL` | `/api` | API-Basis für Produktionsbuilds |
| `TTS` | an | `off` schaltet die erzeugte Aussprache (eSpeak NG) ab |
| `TTS_CACHE_DIR` | `data/tts-cache` | Cache für erzeugte Audiodateien (leer = nur Speicher) |

## Tests

- `npm test` (Backend auf SQLite), `npm run test:pg -w backend` (Postgres), `npx vitest run` in `packages/shared`.
- Browser (Backend + `npm run dev -w web` bzw. `vite preview` laufen lassen): `node web/e2e/<name>.cjs` –
  `viewport-audit`, `flows`, `learning-core`, `scan-audio-review`, `corrections`, `chat` (mit Leistungsmessung), `pwa-csp`.

## Status

Geplant: Spracheingabe (Transkription), japanische Morphologie (Beugungen → Grundform), native Apps.

## Docker

Komplettes Setup (Postgres, Backend, Web mit nginx) per Docker Compose:

```bash
cp .env.example .env          # Werte anpassen, v. a. POSTGRES_PASSWORD
docker compose up -d --build
```

Danach ist die App unter http://localhost:8080 erreichbar (Port über `WEB_PORT` änderbar).
nginx liefert die Web-App aus und leitet `/api/` an das Backend weiter; Migrationen laufen beim Start automatisch.

Wörterbuch einmalig importieren (lädt Frequenzlisten aus dem Internet):

```bash
docker compose run --rm backend npm run import:dictionary -w backend -- starter
```

Optional Beispiel-Songs einspielen:

```bash
docker compose run --rm backend npm run seed:songs -w backend
```

**Daten:** Die Datenbank liegt im Volume `pgdata`, hochgeladene Medien (Avatare) im Volume `media`
(`/app/backend/data/media`). `docker compose down` behält beide, `docker compose down -v` löscht sie.

**Admins und Experten** vergibt der Betreiber per Kommando, nachdem sich die Person registriert hat:
`docker compose run --rm backend node --import tsx scripts/grant-role.ts --email ich@example.com --role admin`
(Experten: `--role expert --lang fa`, Entziehen: `--revoke`). Rollen werden bewusst nicht über E-Mail-Listen
vergeben, weil E-Mail-Adressen nicht verifiziert werden.

**Öffentlich betreiben:** `PUBLIC_ORIGIN` auf die echte URL setzen (z. B. `https://vochat.example.com`), da sie als `CORS_ORIGINS` verwendet wird.

**S3-Medien:** Der Treiber `MEDIA_DRIVER=s3` braucht `@aws-sdk/client-s3` im Backend-Image; das Paket ist standardmäßig nicht enthalten und muss selbst nachinstalliert werden.
