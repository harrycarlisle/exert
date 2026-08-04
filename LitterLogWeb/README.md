# Litter Log (Web PWA)

Private, installable Progressive Web App for one-tap cat bathroom logging — **Pee**, **Poo**, and **Tried to Pee**.

## Live URL

**https://harrycarlisle.github.io/exert/**

(Requires GitHub Pages source set to **GitHub Actions**. See Deployment below.)

## How it relates to the native project

| | Native (`LitterLog/`) | Web (`LitterLogWeb/`) |
|--|--|--|
| Platform | SwiftUI / WidgetKit iOS app | React + Vite PWA |
| Storage | App Group JSON | IndexedDB on device |
| Widget | Interactive Home Screen widget | **Not available** |
| Install | Xcode / TestFlight / App Store | Safari → Add to Home Screen |

The native project is unchanged by web deployment work.

## Privacy & storage

> Your litter records are stored locally on this device. Litter Log does not create an account, track your activity, or upload your records. Records leave your device only when you intentionally export or share them.

- **Primary database:** IndexedDB (`litter-log`)
- **Persistent storage:** requests `navigator.storage.persist()` when supported
- Browser/iOS settings can still clear site data — use **Export JSON Backup** regularly

## Deployment (GitHub Pages)

| Item | Value |
|------|--------|
| Live URL | https://harrycarlisle.github.io/exert/ |
| Method | GitHub Actions → GitHub Pages |
| Workflow | `.github/workflows/deploy-litter-log-web.yml` |
| Branch | `main` |
| Vite base | `/exert/` |
| Artifact | `LitterLogWeb/dist` |

### Required repository setting

**Repository → Settings → Pages → Build and deployment → Source: GitHub Actions**

This setting cannot be enabled by the cloud agent token. After enabling it, run:

**Actions → Deploy Litter Log Web → Run workflow** (branch `main`)

### What the workflow does

1. Installs with `npm ci`
2. Typechecks, lints, and runs unit tests
3. Builds with `BASE_PATH=/exert/`
4. Copies `404.html` + `.nojekyll`
5. Uploads `LitterLogWeb/dist` and deploys with `actions/deploy-pages`

## Local development

```bash
cd LitterLogWeb
npm install
npm run dev
```

## Build

```bash
# Production / GitHub Pages build (asset paths under /exert/)
npm run build:pages

# Root-base build (used by Playwright e2e)
BASE_PATH=/ npm run build
```

## Preview simulating GitHub Pages subpath

```bash
npm run preview:pages
# → http://127.0.0.1:4173/exert/
```

## Test

```bash
npm run typecheck
npm run lint
npm test
npm run build:pages
npx playwright install chromium
npm run test:e2e
```

## Install on iPhone Home Screen

1. Open **https://harrycarlisle.github.io/exert/** in **Safari**
2. Tap Share → **Add to Home Screen**
3. Turn on **Open as Web App** if shown
4. Tap **Add**

This PWA does **not** provide a native interactive iOS widget.

## Browser-storage limitations

Clearing Safari website data can wipe IndexedDB. Keep JSON backups in Files or email.
