import Foundation

/// Central place to update identifiers used for signing and App Groups.
///
/// Update these values in Xcode if you change the bundle ID or App Group:
/// 1. App target bundle identifier
/// 2. Widget target bundle identifier
/// 3. App Group entitlement on both targets
/// 4. These constants (must match the entitlements)
enum AppGroupConfiguration {
    static let appBundleIdentifier = "com.harrycarlisle.LitterLog"
    static let widgetBundleIdentifier = "com.harrycarlisle.LitterLog.Widget"
    static let appGroupIdentifier = "group.com.harrycarlisle.LitterLog"

    static let eventsFileName = "bathroom_events.json"
    static let settingsFileName = "app_settings.json"
    static let widgetKind = "LitterLogWidget"
}
