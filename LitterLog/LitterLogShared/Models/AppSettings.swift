import Foundation

enum AppearancePreference: String, Codable, CaseIterable, Identifiable, Sendable {
    case system
    case light
    case dark

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .system: return "System"
        case .light: return "Light"
        case .dark: return "Dark"
        }
    }
}

enum ExportRangePreference: String, Codable, CaseIterable, Identifiable, Sendable {
    case all
    case last7Days
    case last30Days
    case last90Days

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .all: return "All history"
        case .last7Days: return "Last 7 days"
        case .last30Days: return "Last 30 days"
        case .last90Days: return "Last 90 days"
        }
    }

    func startDate(relativeTo now: Date = .now, calendar: Calendar = .current) -> Date? {
        switch self {
        case .all:
            return nil
        case .last7Days:
            return calendar.date(byAdding: .day, value: -7, to: now)
        case .last30Days:
            return calendar.date(byAdding: .day, value: -30, to: now)
        case .last90Days:
            return calendar.date(byAdding: .day, value: -90, to: now)
        }
    }
}

/// User preferences stored alongside events in the App Group container.
struct AppSettings: Codable, Equatable, Sendable {
    static let currentSchemaVersion = 1

    var catName: String
    var vetPhoneNumber: String
    var hapticsEnabled: Bool
    var appearance: AppearancePreference
    var defaultExportRange: ExportRangePreference
    /// Last time the urinary safety notice was shown to the user.
    var lastSafetyWarningDate: Date?
    var schemaVersion: Int

    static let `default` = AppSettings(
        catName: "",
        vetPhoneNumber: "",
        hapticsEnabled: true,
        appearance: .system,
        defaultExportRange: .all,
        lastSafetyWarningDate: nil,
        schemaVersion: currentSchemaVersion
    )

    var trimmedCatName: String {
        catName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var trimmedVetPhone: String {
        vetPhoneNumber.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    var hasCatName: Bool { !trimmedCatName.isEmpty }
    var hasVetPhone: Bool { !trimmedVetPhone.isEmpty }
}
