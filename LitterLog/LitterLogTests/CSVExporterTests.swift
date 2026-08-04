import XCTest
@testable import LitterLog

final class CSVExporterTests: XCTestCase {
    func testCSVEscapingForCommasQuotesAndLineBreaks() {
        let exporter = CSVExporter(locale: Locale(identifier: "en_US_POSIX"), timeZone: TimeZone(secondsFromGMT: 0)!)
        XCTAssertEqual(exporter.escapeField("plain"), "plain")
        XCTAssertEqual(exporter.escapeField("hello, world"), "\"hello, world\"")
        XCTAssertEqual(exporter.escapeField("she said \"hi\""), "\"she said \"\"hi\"\"\"")
        XCTAssertEqual(exporter.escapeField("line1\nline2"), "\"line1\nline2\"")
    }

    func testCSVChronologicalOrderingOldestFirst() {
        let exporter = CSVExporter(locale: Locale(identifier: "en_US_POSIX"), timeZone: TimeZone(secondsFromGMT: 0)!)
        let older = BathroomEvent(
            type: .pee,
            timestamp: Date(timeIntervalSince1970: 100),
            note: "first",
            source: .app
        )
        let newer = BathroomEvent(
            type: .poo,
            timestamp: Date(timeIntervalSince1970: 200),
            note: "second, with comma",
            source: .widget
        )

        let csv = exporter.export(events: [newer, older])
        let lines = csv.split(separator: "\n").map(String.init)
        XCTAssertTrue(lines[0].contains("Date"))
        XCTAssertTrue(lines[1].contains("Pee"))
        XCTAssertTrue(lines[2].contains("Poo"))
        XCTAssertTrue(lines[2].contains("\"second, with comma\""))
        XCTAssertTrue(lines[1].contains("App"))
        XCTAssertTrue(lines[2].contains("Widget"))
    }

    func testSuggestedFilename() {
        let exporter = CSVExporter()
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
        let date = calendar.date(from: DateComponents(year: 2026, month: 8, day: 4))!
        XCTAssertEqual(exporter.suggestedFilename(for: date, calendar: calendar), "Litter-Log-2026-08-04.csv")
    }
}
