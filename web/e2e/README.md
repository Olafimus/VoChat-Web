# UI-Tests mit Screenshots

Prüft Layout und Bedienung auf Mobile (375 px), Tablet (768 px) und Desktop (1280 px).

```bash
npm install -D playwright -w web          # einmalig
npx playwright install chromium           # einmalig (oder vorhandenen Browser nutzen)

# Server starten (zwei Terminals)
npm run dev:backend
npm run dev:web

# Layout-Prüfung aller Hauptseiten: Screenshots + Überlauf-Check
SHOTS_DIR=screenshots node web/e2e/viewport-audit.cjs

# Interaktive Abläufe: Chat, Tippen, Sammlungen, Community, Profil
SHOTS_DIR=screenshots node web/e2e/flows.cjs
```

Die Skripte melden pro Viewport „ok“ oder die gefundenen Probleme (horizontaler Überlauf,
abgeschnittene Navigation, verdeckte Eingabefelder). Screenshots liegen im Ordner `SHOTS_DIR`.
