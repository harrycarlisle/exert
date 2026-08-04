import XCTest
@testable import LitterLog

final class DateGroupingTests: XCTestCase {
    func testGroupsTodayYesterdayAndDay() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let now = calendar.date(from: DateComponents(year: 2026, month: 8, day: 4, hour: 15))!

        let todayEvent = BathroomEvent(type: .pee, timestamp: now, source: .app)
        let yesterdayEvent = BathroomEvent(
            type: .poo,
            timestamp: calendar.date(byAdding: .day, value: -1, to: now)!,
            source: .app
        )
        let olderEvent = BathroomEvent(
            type: .pee,
            timestamp: calendar.date(byAdding: .day, value: -3, to: now)!,
            source: .app
        )

        let sections = DateGrouping.sections(from: [olderEvent, todayEvent, yesterdayEvent], now: now, calendar: calendar)
        XCTAssertEqual(sections.count, 3)
        XCTAssertEqual(sections[0].group, .today)
        XCTAssertEqual(sections[1].group, .yesterday)
        if case .day = sections[2].group {
            // expected
        } else {
            XCTFail("Expected calendar day group")
        }
    }
}
