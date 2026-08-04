# Litter Log

Private one-tap litter tracking for cat urinary monitoring.

## Projects in this repository

### Native iOS app

- Path: [`LitterLog/`](LitterLog/)
- Xcode project: [`LitterLog/LitterLog.xcodeproj`](LitterLog/LitterLog.xcodeproj)
- Docs: [`LitterLog/README.md`](LitterLog/README.md)
- Includes interactive Home Screen widget (requires Mac + Xcode)

### Web PWA (no Mac required)

- Path: [`LitterLogWeb/`](LitterLogWeb/)
- Docs: [`LitterLogWeb/README.md`](LitterLogWeb/README.md)
- Live URL: **https://harrycarlisle.github.io/exert/**
- Deployed via GitHub Actions (`.github/workflows/deploy-litter-log-web.yml`)
- Install from Safari → Add to Home Screen
- Local-only IndexedDB storage; no backend

**Pages setting required once:** Settings → Pages → Source → **GitHub Actions**

The native and web apps are separate. Prefer the web PWA if you need to use Litter Log on an iPhone immediately without Xcode.
