import Foundation
import WidgetKit

/// Codable-backed store in the App Group container with coordinated atomic writes.
///
/// SwiftData is not used because sharing a SwiftData store reliably with a WidgetKit
/// extension adds complexity and migration risk for this simple event list. A single
/// JSON file with `NSFileCoordinator` and atomic replacement keeps the app and widget
/// on one source of truth without silent overwrites during rapid taps.
final class SharedEventStore: @unchecked Sendable {
    static let shared = SharedEventStore()

    private let fileManager: FileManager
    private let appGroupIdentifier: String
    private let eventsFileName: String
    private let settingsFileName: String
    private let queue = DispatchQueue(label: "com.harrycarlisle.LitterLog.SharedEventStore", qos: .userInitiated)
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    /// Optional override used by unit tests so real App Group data is never touched.
    private let directoryOverride: URL?

    init(
        appGroupIdentifier: String = AppGroupConfiguration.appGroupIdentifier,
        eventsFileName: String = AppGroupConfiguration.eventsFileName,
        settingsFileName: String = AppGroupConfiguration.settingsFileName,
        fileManager: FileManager = .default,
        directoryOverride: URL? = nil
    ) {
        self.appGroupIdentifier = appGroupIdentifier
        self.eventsFileName = eventsFileName
        self.settingsFileName = settingsFileName
        self.fileManager = fileManager
        self.directoryOverride = directoryOverride

        let encoder = JSONEncoder()
        // Encode as seconds since reference date via custom ISO-8601 to avoid
        // fractional-second decode mismatches across app/widget writes.
        encoder.dateEncodingStrategy = .custom { date, enc in
            var container = enc.singleValueContainer()
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withInternetDateTime]
            try container.encode(formatter.string(from: date))
        }
        encoder.outputFormatting = [.sortedKeys]
        self.encoder = encoder

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { dec in
            let container = try dec.singleValueContainer()
            let value = try container.decode(String.self)
            let withFractional = ISO8601DateFormatter()
            withFractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withFractional.date(from: value) {
                return date
            }
            let basic = ISO8601DateFormatter()
            basic.formatOptions = [.withInternetDateTime]
            if let date = basic.date(from: value) {
                return date
            }
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Invalid ISO8601 date: \(value)")
        }
        self.decoder = decoder
    }

    // MARK: - Container

    func containerURL() throws -> URL {
        if let directoryOverride {
            if !fileManager.fileExists(atPath: directoryOverride.path) {
                try fileManager.createDirectory(at: directoryOverride, withIntermediateDirectories: true)
            }
            return directoryOverride
        }
        guard let url = fileManager.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier) else {
            throw SharedStoreError.appGroupUnavailable
        }
        return url
    }

    private func eventsURL() throws -> URL {
        try containerURL().appendingPathComponent(eventsFileName)
    }

    private func settingsURL() throws -> URL {
        try containerURL().appendingPathComponent(settingsFileName)
    }

    // MARK: - Events

    func fetchEvents() throws -> [BathroomEvent] {
        try queue.sync {
            try loadPayload().events.sorted { $0.timestamp > $1.timestamp }
        }
    }

    @discardableResult
    func insert(
        type: BathroomEventType,
        timestamp: Date = .now,
        note: String? = nil,
        source: EventSource,
        createdAt: Date = .now
    ) throws -> BathroomEvent {
        let event = BathroomEvent(
            type: type,
            timestamp: timestamp,
            note: normalizedNote(note),
            source: source,
            createdAt: createdAt
        )
        try queue.sync {
            var payload = try loadPayload()
            payload.events.append(event)
            try savePayload(payload)
        }
        reloadWidgetTimelines()
        return event
    }

    @discardableResult
    func insert(_ event: BathroomEvent) throws -> BathroomEvent {
        var stored = event
        stored.note = normalizedNote(event.note)
        try queue.sync {
            var payload = try loadPayload()
            payload.events.append(stored)
            try savePayload(payload)
        }
        reloadWidgetTimelines()
        return stored
    }

    /// Inserts many events in one coordinated write (useful for rapid-insert tests).
    @discardableResult
    func insertMany(_ events: [BathroomEvent]) throws -> [BathroomEvent] {
        let normalized = events.map { event -> BathroomEvent in
            var copy = event
            copy.note = normalizedNote(event.note)
            return copy
        }
        try queue.sync {
            var payload = try loadPayload()
            payload.events.append(contentsOf: normalized)
            try savePayload(payload)
        }
        reloadWidgetTimelines()
        return normalized
    }

    func update(_ event: BathroomEvent) throws {
        try queue.sync {
            var payload = try loadPayload()
            guard let index = payload.events.firstIndex(where: { $0.id == event.id }) else {
                throw SharedStoreError.eventNotFound
            }
            var updated = event
            updated.note = normalizedNote(event.note)
            payload.events[index] = updated
            try savePayload(payload)
        }
        reloadWidgetTimelines()
    }

    func delete(id: UUID) throws {
        try queue.sync {
            var payload = try loadPayload()
            let before = payload.events.count
            payload.events.removeAll { $0.id == id }
            guard payload.events.count < before else {
                throw SharedStoreError.eventNotFound
            }
            try savePayload(payload)
        }
        reloadWidgetTimelines()
    }

    func deleteAll() throws {
        try queue.sync {
            try savePayload(.empty)
        }
        reloadWidgetTimelines()
    }

    func todaySummary(on day: Date = .now, calendar: Calendar = .current) throws -> TodaySummary {
        let events = try fetchEvents()
        return TodaySummary.calculate(from: events, on: day, calendar: calendar)
    }

    // MARK: - Settings

    func fetchSettings() throws -> AppSettings {
        try queue.sync {
            try loadSettings()
        }
    }

    func saveSettings(_ settings: AppSettings) throws {
        try queue.sync {
            try writeSettings(settings)
        }
        reloadWidgetTimelines()
    }

    // MARK: - Coordinated IO

    private func loadPayload() throws -> EventStorePayload {
        let url = try eventsURL()
        guard fileManager.fileExists(atPath: url.path) else {
            return .empty
        }

        var coordinatedError: NSError?
        var result: Result<EventStorePayload, Error> = .success(.empty)

        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(readingItemAt: url, options: [], error: &coordinatedError) { readURL in
            do {
                let data = try Data(contentsOf: readURL)
                if data.isEmpty {
                    result = .success(.empty)
                    return
                }
                do {
                    let payload = try self.decoder.decode(EventStorePayload.self, from: data)
                    result = .success(payload)
                } catch {
                    // Attempt to recover a bare event array from older/partial schemas.
                    if let events = try? self.decoder.decode([BathroomEvent].self, from: data) {
                        result = .success(EventStorePayload(schemaVersion: EventStorePayload.currentSchemaVersion, events: events))
                    } else {
                        // Quarantine unreadable data and continue with an empty store so writes can proceed.
                        let quarantine = readURL.appendingPathExtension("corrupt-\(Int(Date().timeIntervalSince1970))")
                        try? self.fileManager.moveItem(at: readURL, to: quarantine)
                        result = .success(.empty)
                    }
                }
            } catch {
                result = .failure(SharedStoreError.readFailed(error.localizedDescription))
            }
        }

        if let coordinatedError {
            throw SharedStoreError.readFailed(coordinatedError.localizedDescription)
        }
        return try result.get()
    }

    private func savePayload(_ payload: EventStorePayload) throws {
        let url = try eventsURL()
        let data: Data
        do {
            data = try encoder.encode(payload)
        } catch {
            throw SharedStoreError.encodeFailed
        }

        var coordinatedError: NSError?
        var writeError: Error?

        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: &coordinatedError) { writeURL in
            do {
                // Atomic write via temporary neighbor file, then replace.
                let tempURL = writeURL.appendingPathExtension("tmp-\(UUID().uuidString)")
                try data.write(to: tempURL, options: .atomic)
                if self.fileManager.fileExists(atPath: writeURL.path) {
                    _ = try self.fileManager.replaceItemAt(writeURL, withItemAt: tempURL)
                } else {
                    try self.fileManager.moveItem(at: tempURL, to: writeURL)
                }
            } catch {
                writeError = SharedStoreError.writeFailed(error.localizedDescription)
            }
        }

        if let coordinatedError {
            throw SharedStoreError.writeFailed(coordinatedError.localizedDescription)
        }
        if let writeError {
            throw writeError
        }
    }

    private func loadSettings() throws -> AppSettings {
        let url = try settingsURL()
        guard fileManager.fileExists(atPath: url.path) else {
            return .default
        }

        var coordinatedError: NSError?
        var result: Result<AppSettings, Error> = .success(.default)

        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(readingItemAt: url, options: [], error: &coordinatedError) { readURL in
            do {
                let data = try Data(contentsOf: readURL)
                if data.isEmpty {
                    result = .success(.default)
                    return
                }
                if let settings = try? self.decoder.decode(AppSettings.self, from: data) {
                    result = .success(settings)
                } else {
                    result = .success(.default)
                }
            } catch {
                result = .failure(SharedStoreError.readFailed(error.localizedDescription))
            }
        }

        if let coordinatedError {
            throw SharedStoreError.readFailed(coordinatedError.localizedDescription)
        }
        return try result.get()
    }

    private func writeSettings(_ settings: AppSettings) throws {
        let url = try settingsURL()
        let data: Data
        do {
            data = try encoder.encode(settings)
        } catch {
            throw SharedStoreError.encodeFailed
        }

        var coordinatedError: NSError?
        var writeError: Error?

        let coordinator = NSFileCoordinator(filePresenter: nil)
        coordinator.coordinate(writingItemAt: url, options: .forReplacing, error: &coordinatedError) { writeURL in
            do {
                let tempURL = writeURL.appendingPathExtension("tmp-\(UUID().uuidString)")
                try data.write(to: tempURL, options: .atomic)
                if self.fileManager.fileExists(atPath: writeURL.path) {
                    _ = try self.fileManager.replaceItemAt(writeURL, withItemAt: tempURL)
                } else {
                    try self.fileManager.moveItem(at: tempURL, to: writeURL)
                }
            } catch {
                writeError = SharedStoreError.writeFailed(error.localizedDescription)
            }
        }

        if let coordinatedError {
            throw SharedStoreError.writeFailed(coordinatedError.localizedDescription)
        }
        if let writeError {
            throw writeError
        }
    }

    private func normalizedNote(_ note: String?) -> String? {
        guard let note else { return nil }
        let trimmed = note.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? nil : trimmed
    }

    private func reloadWidgetTimelines() {
        // No-op in pure Foundation unit-test contexts without WidgetKit linkage side effects.
        #if canImport(WidgetKit)
        WidgetCenter.shared.reloadTimelines(ofKind: AppGroupConfiguration.widgetKind)
        #endif
    }
}
