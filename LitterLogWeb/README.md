# Litter Log (Web PWA)

Private, installable Progressive Web App for one-tap cat bathroom logging — **Pee**, **Poo**, and **Tried to Pee**.

This web version exists so the app can be used on an iPhone **without a Mac or Apple Developer account**, by adding it to the Home Screen from Safari.

## How it relates to the native project

|          | Native (`LitterLog/`)          | Web (`LitterLogWeb/`)                 |
| -------- | ------------------------------ | ------------------------------------- |
| Platform | SwiftUI / WidgetKit iOS app    | React + Vite PWA                      |
| Storage  | App Group JSON                 | IndexedDB on device                   |
| Widget   | Interactive Home Screen widget | **Not available** (Safari limitation) |
| Install  | Xcode / TestFlight / App Store | Safari → Add to Home Screen           |

The native project is unchanged and remains the App Store–ready implementation. The web app is a separate, local-only companion.

## What it does

1. Open Litter Log (standalone after Home Screen install).
2. Tap Pee, Poo, or Tried to Pee.
3. Exact date/time is saved immediately on this device.
4. Confirmation + Undo appear.
5. Review, edit, delete, export CSV, or back up/restore JSON later.

No accounts, no backend, no analytics, no remote database.

## Privacy & storage

> Your litter records are stored locally on this device. Litter Log does not create an account, track your activity, or upload your records. Records leave your device only when you intentionally export or share them.

- **Primary database:** IndexedDB (`litter-log`)
- **Preferences:** IndexedDB settings store (+ tiny UI flags)
- **Persistent storage:** requests `navigator.storage.persist()` when supported
- **Honest limitation:** iOS, Safari, or the user can still clear site data. Use **Export JSON Backup** regularly.

## Offline & PWA

- `vite-plugin-pwa` generates a service worker and web manifest
- After the first successful load, the app shell works offline
- Logging, history, editing, CSV export, and JSON backup/restore all work offline
- When a new version is deployed, an **Update available** prompt appears; records are never erased by an update

## Local development

```bash
cd LitterLogWeb
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Test

```bash
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run build && npm run test:e2e
```

## Deploy

Static site output is `LitterLogWeb/dist`.

### GitHub Pages (already prepared)

The production build is published on the `gh-pages` branch.

**One required manual action** (this agent cannot enable Pages with the current GitHub token):

1. Open https://github.com/harrycarlisle/exert/settings/pages
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**
3. Branch: `gh-pages` / folder: `/ (root)` → Save

After that, the app should be available at:

**https://harrycarlisle.github.io/exert/**

A GitHub Actions workflow (`.github/workflows/deploy-litter-log-web.yml`) can also deploy via the Pages environment once Pages is enabled for Actions.

### Vercel

Root `vercel.json` builds `LitterLogWeb` and publishes `LitterLogWeb/dist`.

```bash
# from repo root, with Vercel CLI authenticated
npx vercel --prod
```

Or import the GitHub repo in the Vercel dashboard (uses root `vercel.json`).

This environment did **not** have a Vercel token, so Vercel production deploy was not completed here.

## Install on iPhone Home Screen

1. Open the deployed HTTPS URL in **Safari** (not Chrome).
2. Tap the **Share** button.
3. Tap **Add to Home Screen**.
4. Turn on **Open as Web App** if that option appears.
5. Tap **Add**.
6. Launch from the new Home Screen icon.

This does **not** provide a native interactive iOS widget.

## CSV export

Settings or History → **Export CSV**.

Columns: Date, Time, ISO 8601 Timestamp, Event Type, Note, Recorded From  
Sorted oldest → newest, with proper escaping. Uses Web Share when available, otherwise downloads the file.

## JSON backup & restore

- **Export JSON Backup** writes events + settings + schema version + backup timestamp
- **Import JSON Backup** validates first, then merges by event ID (never silently deletes existing records)
- Settings shows the last successful backup date when known

## Browser-storage limitations

Even with persistent storage requests:

- Clearing Safari history/data can wipe IndexedDB
- Removing the Home Screen icon does not always delete data, but “Clear Website Data” does
- Keep JSON backups somewhere safe (Files, email to yourself, etc.)

## Scripts

| Script              | Purpose                      |
| ------------------- | ---------------------------- |
| `npm run dev`       | Local Vite server            |
| `npm run build`     | Typecheck + production build |
| `npm run preview`   | Serve production build       |
| `npm test`          | Vitest unit tests            |
| `npm run test:e2e`  | Playwright flow              |
| `npm run lint`      | ESLint                       |
| `npm run typecheck` | `tsc -b`                     |
