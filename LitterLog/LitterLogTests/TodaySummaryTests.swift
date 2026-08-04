import XCTest
@testable import LitterLog

final class TodaySummaryTests: XCTestCase {
    private var calendar: Calendar!

    override func setUp() {
        calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    }

    func testTodayCountsUseCalendarDayBoundaries() {
        let today = calendar.date(from: DateComponents(year: 2026, month: 8, day: 4, hour: 12))!
        let yesterday = calendar.date(byAdding: .day, value: -1, to: today)!
        let earlyToday = calendar.date(bySettingHour: 0, minute: 5, second: 0, of: today)!
        let lateToday = calendar.date(bySettingHour: 23, minute: 50, second: 0, of: today)!

        let events = [
            BathroomEvent(type: .pee, timestamp: earlyToday, source: .app),
            BathroomEvent(type: .pee, timestamp: lateToday, source: .app),
            BathroomEvent(type: .poo, timestamp: today, source: .app),
            BathroomEvent(type: .triedToPee, timestamp: today, source: .widget),
            BathroomEvent(type: .pee, timestamp: yesterday, source: .app)
        ]

        let summary = TodaySummary.calculate(from: events, on: today, calendar: calendar)
        XCTAssertEqual(summary.peeCount, 2)
        XCTAssertEqual(summary.pooCount, 1)
        XCTAssertEqual(summary.triedCount, 1)
        XCTAssertEqual(summary.mostRecentTimestamp, lateToday)
    }

    func testSingularAndPluralSummaryLanguage() {
        let singular = TodaySummary(peeCount: 1, pooCount: 1, triedCount: 1, mostRecentTimestamp: nil)
        XCTAssertEqual(singular.compactDescription(), "Today: 1 pee · 1 poo · 1 attempt")

        let plural = TodaySummary(peeCount: 3, pooCount: 2, triedCount: 0, mostRecentTimestamp: nil)
        XCTAssertEqual(plural.compactDescription(), "Today: 3 pees · 2 poos · 0 attempts")
    }
}
