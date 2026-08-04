import XCTest
@testable import LitterLog

final class SharedEventStoreTests: XCTestCase {
    private var directory: URL!
    private var store: SharedEventStore!

    override func setUpWithError() throws {
        directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("LitterLogTests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        store = SharedEventStore(directoryOverride: directory)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: directory)
        directory = nil
        store = nil
    }

    func testCreateEachEventType() throws {
        _ = try store.insert(type: .pee, source: .app)
        _ = try store.insert(type: .poo, source: .widget)
        _ = try store.insert(type: .triedToPee, source: .app)

        let events = try store.fetchEvents()
        XCTAssertEqual(events.count, 3)
        XCTAssertEqual(Set(events.map(\.type)), Set([.pee, .poo, .triedToPee]))
    }

    func testStoreAndRetrievePersistsAcrossInstances() throws {
        let created = try store.insert(type: .pee, note: "morning", source: .app)
        let reloaded = SharedEventStore(directoryOverride: directory)
        let events = try reloaded.fetchEvents()
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].id, created.id)
        XCTAssertEqual(events[0].note, "morning")
        XCTAssertEqual(events[0].source, .app)
    }

    func testRapidInsertsPreserveAllEntries() throws {
        let batch = (0..<20).map { index in
            BathroomEvent(
                type: index.isMultiple(of: 2) ? .pee : .poo,
                timestamp: Date().addingTimeInterval(TimeInterval(index)),
                source: .widget
            )
        }
        _ = try store.insertMany(batch)
        let events = try store.fetchEvents()
        XCTAssertEqual(events.count, 20)
        XCTAssertEqual(Set(events.map(\.id)).count, 20)
    }

    func testDeleteEvent() throws {
        let event = try store.insert(type: .poo, source: .app)
        try store.delete(id: event.id)
        XCTAssertTrue(try store.fetchEvents().isEmpty)
    }

    func testEditEvent() throws {
        var event = try store.insert(type: .pee, source: .app)
        event.type = .triedToPee
        event.note = "straining"
        let newTimestamp = Date().addingTimeInterval(-3600)
        event.timestamp = newTimestamp
        try store.update(event)

        let events = try store.fetchEvents()
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].type, .triedToPee)
        XCTAssertEqual(events[0].note, "straining")
        XCTAssertEqual(events[0].timestamp.timeIntervalSince1970, newTimestamp.timeIntervalSince1970, accuracy: 0.001)
    }

    func testMissingFileReturnsEmpty() throws {
        XCTAssertTrue(try store.fetchEvents().isEmpty)
        XCTAssertEqual(try store.fetchSettings(), .default)
    }

    func testCorruptPersistenceRecoversSafely() throws {
        let url = directory.appendingPathComponent(AppGroupConfiguration.eventsFileName)
        try Data("not-json{{{".utf8).write(to: url)

        // Unreadable data is quarantined and treated as an empty store (no crash).
        XCTAssertTrue(try store.fetchEvents().isEmpty)
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))

        _ = try store.insert(type: .pee, source: .app)
        XCTAssertEqual(try store.fetchEvents().count, 1)
    }

    func testEmptyFileTreatedAsEmptyStore() throws {
        let url = directory.appendingPathComponent(AppGroupConfiguration.eventsFileName)
        try Data().write(to: url)
        XCTAssertTrue(try store.fetchEvents().isEmpty)
    }

    func testAppIntentStyleInsertion() throws {
        // Mirrors widget intent insertion without requiring WidgetCenter side effects beyond store writes.
        let event = try store.insert(type: .triedToPee, source: .widget)
        XCTAssertEqual(event.source, .widget)
        XCTAssertEqual(try store.fetchEvents().first?.type, .triedToPee)
    }
}
