#!/usr/bin/env python3
"""Static validation for the Litter Log Xcode project (runs without macOS/Xcode)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors: list[str] = []
warnings: list[str] = []


def ok(msg: str) -> None:
    print(f"OK  {msg}")


def err(msg: str) -> None:
    errors.append(msg)
    print(f"ERR {msg}")


def warn(msg: str) -> None:
    warnings.append(msg)
    print(f"WARN {msg}")


def main() -> int:
    pbx = ROOT / "LitterLog.xcodeproj" / "project.pbxproj"
    if not pbx.exists():
        err("Missing project.pbxproj")
        return 1

    text = pbx.read_text()

    for target in ("LitterLog", "LitterLogWidget", "LitterLogTests"):
        if f"name = {target};" in text:
            ok(f"Target exists: {target}")
        else:
            err(f"Missing target: {target}")

    if "com.harrycarlisle.LitterLog" in text and "com.harrycarlisle.LitterLog.Widget" in text:
        ok("Bundle identifiers present in project settings")
    else:
        err("Bundle identifiers missing from project settings")

    app_ent = (ROOT / "LitterLog" / "LitterLog.entitlements").read_text()
    widget_ent = (ROOT / "LitterLogWidget" / "LitterLogWidget.entitlements").read_text()
    group = "group.com.harrycarlisle.LitterLog"
    if group in app_ent and group in widget_ent:
        ok(f"App Group {group} present on both entitlements")
    else:
        err("App Group mismatch or missing in entitlements")

    required = [
        "LitterLogShared/Persistence/SharedEventStore.swift",
        "LitterLogShared/Intents/LogBathroomEventIntent.swift",
        "LitterLogWidget/LitterLogWidget.swift",
        "LitterLog/Features/Home/HomeView.swift",
        "LitterLog/Features/History/HistoryView.swift",
        "LitterLog/Features/Settings/SettingsView.swift",
        "LitterLog/Export/ExportSheetView.swift",
        "LitterLogTests/SharedEventStoreTests.swift",
        "LitterLogTests/CSVExporterTests.swift",
        "README.md",
    ]
    for rel in required:
        path = ROOT / rel
        if path.exists() and path.stat().st_size > 0:
            ok(f"File present: {rel}")
        else:
            err(f"Missing or empty: {rel}")

    intent = (ROOT / "LitterLogShared/Intents/LogBathroomEventIntent.swift").read_text()
    if "openAppWhenRun: Bool = false" in intent and "AppIntent" in intent:
        ok("App Intents configured to log without opening the app")
    else:
        err("App Intent openAppWhenRun / AppIntent setup incomplete")

    widget = (ROOT / "LitterLogWidget/LitterLogWidget.swift").read_text()
    if "Button(intent:" in widget and "LogPeeIntent" in widget:
        ok("Widget uses interactive App Intent buttons")
    else:
        err("Widget missing App Intent buttons")

    store = (ROOT / "LitterLogShared/Persistence/SharedEventStore.swift").read_text()
    if "NSFileCoordinator" in store and "directoryOverride" in store:
        ok("Shared Codable store uses coordinated writes and test override")
    else:
        err("Shared store missing coordination or test isolation")

    # Ensure no network/analytics packages
    for path in ROOT.rglob("*.swift"):
        content = path.read_text(errors="ignore")
        for needle in ("Firebase", "Amplitude", "Mixpanel", "URLSession.shared.data", "Alamofire"):
            if needle in content:
                warn(f"Possible network/analytics usage in {path.relative_to(ROOT)}: {needle}")

    # Sample data not seeded in app launch
    app = (ROOT / "LitterLog/LitterLogApp.swift").read_text()
    if "SampleData" in app:
        err("SampleData referenced from app entry point")
    else:
        ok("App entry point does not seed SampleData")

    # Count swift sources in pbx
    app_sources = len(re.findall(r"buildfile-app:", text))  # may not appear as text
    swift_refs = len(re.findall(r"lastKnownFileType = sourcecode.swift", text))
    if swift_refs >= 30:
        ok(f"Swift file references in project: {swift_refs}")
    else:
        warn(f"Unexpectedly few Swift file references: {swift_refs}")

    print()
    print(f"Validation finished with {len(errors)} error(s), {len(warnings)} warning(s).")
    if errors:
        print("This environment cannot run xcodebuild (not macOS). Fix errors above, then build on a Mac.")
        return 1
    print("Static checks passed. xcodebuild / simulator / device checks require macOS + Xcode.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
