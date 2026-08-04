import Foundation

/// A single recorded bathroom event.
struct BathroomEvent: Identifiable, Codable, Equatable, Sendable, Hashable {
    /// Schema version for future migrations.
    static let currentSchemaVersion = 1

    var id: UUID
    var type: BathroomEventType
    /// Exact time the bathroom event occurred.
    var timestamp: Date
    var note: String?
    var source: EventSource
    /// When the record was created in the store (may differ from `timestamp` for manual entries).
    var createdAt: Date
    var schemaVersion: Int

    init(
        id: UUID = UUID(),
        type: BathroomEventType,
        timestamp: Date = .now,
        note: String? = nil,
        source: EventSource,
        createdAt: Date = .now,
        schemaVersion: Int = BathroomEvent.currentSchemaVersion
    ) {
        self.id = id
        self.type = type
        self.timestamp = timestamp
        self.note = note
        self.source = source
        self.createdAt = createdAt
        self.schemaVersion = schemaVersion
    }

    var hasNote: Bool {
        guard let note else { return false }
        return !note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }
}
