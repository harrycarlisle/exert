# Litter Log

A fast, personal iPhone utility for logging cat bathroom events — **Pee**, **Poo**, and **Tried to Pee** — with one tap from the app or an interactive Home Screen widget.

Litter Log is built for urinary-issue tracking: quick capture, local history, undo, and CSV export for a veterinarian. There is no account, cloud sync, analytics, ads, or subscription.

**Minimum iOS:** 17.0  
**Languages / frameworks:** Swift, SwiftUI, WidgetKit, App Intents

---

## Project location

```
LitterLog/
├── LitterLog.xcodeproj      # Open this in Xcode
├── LitterLog/               # Main app target
├── LitterLogWidget/         # Interactive widget extension
├── LitterLogShared/         # Shared models, persistence, intents, export
├── LitterLogTests/          # Unit tests
├── ci_scripts/              # Project generator + static validation
└── README.md
```

Open **`LitterLog/LitterLog.xcodeproj`** in Xcode on a Mac.

---

## What you can do

1. Tap **Pee**, **Poo**, or **Tried to Pee** in the app or widget.
2. The event is saved immediately with the current timestamp.
3. See a short confirmation and **Undo** the latest accidental entry.
4. Review history (grouped by day), edit notes/times, or add a missed entry.
5. Export CSV via the system share sheet for your vet.
6. Optionally set a cat name and vet phone number in Settings.
7. See a careful urinary safety notice when “Tried to Pee” is first recorded (and again only when multiple attempts occur within a window — never before the event is saved).

---

## Targets

| Target | Bundle ID | Purpose |
|--------|-----------|---------|
| **LitterLog** | `com.harrycarlisle.LitterLog` | Main iOS app |
| **LitterLogWidget** | `com.harrycarlisle.LitterLog.Widget` | Interactive Home Screen widget |
| **LitterLogTests** | `com.harrycarlisle.LitterLog.Tests` | Unit tests |

**App Group (shared container):** `group.com.harrycarlisle.LitterLog`

---

## Persistence choice

Litter Log uses a **Codable JSON store** in the App Group container (`bathroom_events.json` + `app_settings.json`), with:

- `NSFileCoordinator` for coordinated reads/writes
- Atomic temp-file replace to avoid torn writes
- A serial queue so rapid taps from the app and widget do not silently overwrite each other
- Corrupt-file quarantine + empty-store recovery so the app does not crash on bad data

**Why not SwiftData?** Sharing a SwiftData store reliably with a WidgetKit extension adds complexity and migration risk for a small event list. One JSON file kept in the App Group is the simplest reliable shared source of truth for this app.

Shared reads/writes are centralized in `LitterLogShared/Persistence/SharedEventStore.swift`. The app and widget never maintain separate databases.

---

## Identifiers to update for signing

If you change naming or use your own team identifiers, update **all** of these so they stay in sync:

1. **Xcode → LitterLog target → Signing & Capabilities**
   - Bundle Identifier → e.g. `com.yourname.LitterLog`
   - App Groups → e.g. `group.com.yourname.LitterLog`
2. **Xcode → LitterLogWidget target → Signing & Capabilities**
   - Bundle Identifier → e.g. `com.yourname.LitterLog.Widget` (must be under the app ID)
   - **Same** App Group as the app
3. Entitlements files:
   - `LitterLog/LitterLog.entitlements`
   - `LitterLogWidget/LitterLogWidget.entitlements`
4. Constants in:
   - `LitterLogShared/Utilities/AppGroupConfiguration.swift`
5. Project build settings (`PRODUCT_BUNDLE_IDENTIFIER`) in the Xcode project if you edit them outside Signing & Capabilities

The widget **must** use the identical App Group as the app or logging from the widget will not appear in the app.

---

## How to open and run

### Requirements

- A Mac with **Xcode 15+** (iOS 17 SDK)
- An iPhone on **iOS 17+** (or Simulator)
- For physical device install and App Groups: a free or paid **Apple Developer** account signed into Xcode

### First launch in Xcode

1. Clone / download this repo on a Mac.
2. Open `LitterLog/LitterLog.xcodeproj`.
3. Select the **LitterLog** scheme.
4. Select your **Team** under Signing & Capabilities for both **LitterLog** and **LitterLogWidget**.
5. If Xcode complains about the App Group, enable **App Groups** on both targets and ensure `group.com.harrycarlisle.LitterLog` is checked (or your renamed group).
6. Choose an iPhone simulator or a connected device.
7. Press **Run** (⌘R).

### Install on a personal iPhone from Xcode

1. Connect the iPhone with a cable (or use wireless debugging after pairing).
2. Trust the computer on the phone if prompted.
3. In Xcode, choose your iPhone as the run destination.
4. Set your Team for both targets (Signing & Capabilities).
5. Run the app (⌘R).
6. On the iPhone: **Settings → General → VPN & Device Management** (wording varies) → trust your developer certificate if prompted.
7. Launch **Litter Log** from the Home Screen.

**Note:** With a free Apple ID, apps typically expire after about 7 days and must be reinstalled from Xcode. A paid Apple Developer Program membership is required for longer-lived installs and TestFlight / App Store distribution.

### Add the Home Screen widget

1. Long-press the Home Screen → tap **Edit** / **+**.
2. Search for **Litter Log**.
3. Add the **Small** or **Medium** widget.
4. Tap a colored button on the widget — the event is saved **without opening the app** (App Intents).

---

## How to run tests

In Xcode:

1. Select the **LitterLog** scheme.
2. Press **⌘U**, or **Product → Test**.

From Terminal on a Mac:

```bash
cd LitterLog
xcodebuild test \
  -scheme LitterLog \
  -destination 'platform=iOS Simulator,name=iPhone 16'
```

Tests use an isolated temporary directory (`directoryOverride`) and never touch real App Group user data.

### Static validation without Xcode

On any machine (including Linux CI):

```bash
cd LitterLog
python3 ci_scripts/validate_project.py
```

This checks targets, App Group entitlements, App Intent wiring, and required files. It does **not** compile Swift.

---

## Export (CSV)

From **History → ⋯ → Export CSV** or **Settings → Export History**.

Columns:

`Date, Time, Timestamp, Event Type, Note, Recorded From`

- Sorted oldest → newest
- Commas, quotes, and line breaks are escaped
- Filename example: `Litter-Log-2026-08-04.csv`
- Shared with the system share sheet only — nothing is uploaded automatically

---

## Architecture overview

```
LitterLogShared/
  Models/          BathroomEvent, types, settings, TodaySummary
  Persistence/     SharedEventStore (App Group JSON)
  Intents/         LogPee / LogPoo / LogTriedToPee App Intents
  Export/          CSVExporter
  Utilities/       palette, grouping, safety policy, App Group IDs

LitterLog/
  Features/Home|History|Settings
  SharedUI/        buttons, rows, safety sheet
  Export/          share sheet UI

LitterLogWidget/   timeline provider + interactive buttons
LitterLogTests/    store, summary, CSV, safety, grouping tests
```

---

## Privacy

> Your litter records are stored locally on this device. Litter Log does not create an account, track your activity, or upload your records.

There are no analytics SDKs, advertising identifiers, or network API calls in the project. `PrivacyInfo.xcprivacy` declares that tracking is not used.

---

## Known limitations

- This cloud/Linux agent environment **cannot run `xcodebuild`**. Build, simulator, device, widget interaction, light/dark visual checks, and XCTest execution must be done on a Mac with Xcode.
- App Groups on a physical device require a signed team; the Simulator is more forgiving but you should still configure the capability in Xcode.
- Widget “confirmation” is limited by WidgetKit (intent dialog / timeline refresh); the richest undo UI is in the main app.
- PDF export is not included (CSV is fully implemented; the exporter is structured so PDF can be added later).
- The placeholder app icon is a solid teal image — replace `AppIcon.appiconset/AppIcon.png` with your own 1024×1024 artwork before shipping.
- Free provisioning installs expire; use a paid Apple Developer account for TestFlight / App Store.

---

## TestFlight / App Store (later)

1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/).
2. In [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list):
   - Create App ID `com.harrycarlisle.LitterLog` (or your ID)
   - Create App Group `group.com.harrycarlisle.LitterLog`
   - Create App ID for the widget extension and enable the same App Group
3. In Xcode, archive (**Product → Archive**) and upload via Organizer.
4. Configure the app record in App Store Connect and submit for TestFlight or review.
5. Update privacy nutrition labels to match: data not collected / not linked (local-only storage; user-initiated export only).

---

## Regenerating the Xcode project file

If you add Swift files, update `ci_scripts/generate_xcodeproj.py` and run:

```bash
python3 ci_scripts/generate_xcodeproj.py
```

Then re-check the shared scheme’s BlueprintIdentifiers if targets changed.

---

## Medical disclaimer

Litter Log helps you keep a log. It does **not** diagnose disease, estimate severity from counts, or replace veterinary care. If your cat repeatedly strains with little or no urine, contact a veterinarian or emergency clinic promptly.
