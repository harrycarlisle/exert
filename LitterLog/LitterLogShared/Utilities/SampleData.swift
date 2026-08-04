import Foundation

/// Sample bathroom events for SwiftUI previews and tests only.
/// Never seed these into the real App Group store from production app paths.
enum SampleData {
    static func events(referenceDate: Date = Date(timeIntervalSince1970: 1_785_873_600)) -> [BathroomEvent] {
        let calendar = Calendar(identifier: .gregorian)
        func date(daysAgo: Int, hour: Int, minute: Int) -> Date {
            let day = calendar.date(byAdding: .day, value: -daysAgo, to: referenceDate) ?? referenceDate
            return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
        }

        return [
            BathroomEvent(type: .pee, timestamp: date(daysAgo: 0, hour: 8, minute: 12), source: .app),
            BathroomEvent(type: .poo, timestamp: date(daysAgo: 0, hour: 9, minute: 40), note: "Firm", source: .widget),
            BathroomEvent(type: .triedToPee, timestamp: date(daysAgo: 0, hour: 14, minute: 5), source: .app),
            BathroomEvent(type: .pee, timestamp: date(daysAgo: 0, hour: 17, minute: 14), source: .widget),
            BathroomEvent(type: .pee, timestamp: date(daysAgo: 1, hour: 7, minute: 50), source: .app),
            BathroomEvent(type: .poo, timestamp: date(daysAgo: 1, hour: 19, minute: 22), source: .app),
            BathroomEvent(type: .pee, timestamp: date(daysAgo: 2, hour: 11, minute: 3), note: "After fluids", source: .app)
        ]
    }

    static let settingsWithCat = AppSettings(
        catName: "Mochi",
        vetPhoneNumber: "555-0100",
        hapticsEnabled: true,
        appearance: .system,
        defaultExportRange: .last30Days,
        lastSafetyWarningDate: nil,
        schemaVersion: AppSettings.currentSchemaVersion
    )
}
