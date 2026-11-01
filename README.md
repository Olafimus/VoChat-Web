# VoChat

Vokabel-Lern-App im Chat-Stil: Du schreibst Wörter, bekommst Bedeutungen, Beispiele und Niveaus,
legst sie in deine Liste und lernst sie mit Wiederholungsplan. Funktioniert offline; Änderungen werden
synchronisiert, sobald eine Verbindung besteht.

- **Sprachen:** Deutsch, Englisch, Spanisch, Persisch (erweiterbar)
- **Stack:** TypeScript · Backend: Hono + eingebautes `node:sqlite` · Web: React, Vite, TanStack DB, IndexedDB
- **Auth:** E-Mail/Passwort, Sitzungs-Token

## Einrichtung

Voraussetzung: Node.js ≥ 22.13 (eingebautes SQLite).

```bash
npm install
npm run import:dictionary -w backend -- starter   # Wörterbuchdaten laden (ca. 15 s, braucht Internet)
npm run dev:backend                               # API auf http://localhost:8787
npm run dev:web                                   # App auf http://localhost:5173
```

Die Datenbank liegt in `backend/data/vochat.db` (wird automatisch angelegt, nicht versioniert).

Tests:

```bash
npm test                                          # Shared + Backend (Auth, Sync, Wörterbuch, Importer)
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

## Wörterbuchquellen

Siehe [docs/DICTIONARY_SOURCES.md](docs/DICTIONARY_SOURCES.md): welche Quellen geprüft und importiert sind,
was fehlt und wie du die vollständigen Wiktionary-Daten (kaikki.org) lokal einspielst.

## Konfiguration

| Variable | Standard | Zweck |
|---|---|---|
| `PORT` | `8787` | Port der API |
| `DB_PATH` | `data/vochat.db` | SQLite-Datei |
| `CORS_ORIGINS` | `http://localhost:5173` | Erlaubte Web-Origins (kommagetrennt) |
| `VITE_BACKEND_URL` | `http://localhost:8787` | Ziel des Dev-Proxys `/api` |
| `VITE_API_URL` | `/api` | API-Basis für Produktionsbuilds |

## Status

Erster Wurf. Geplant: Bild- und Spracheingabe mit Extraktion neuer Vokabeln (siehe `docs/ARCHITECTURE.md`).
