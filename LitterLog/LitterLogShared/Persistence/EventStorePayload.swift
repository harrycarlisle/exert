import Foundation

/// On-disk envelope for bathroom events.
struct EventStorePayload: Codable, Equatable, Sendable {
    static let currentSchemaVersion = 1

    var schemaVersion: Int
    var events: [BathroomEvent]

    static let empty = EventStorePayload(schemaVersion: currentSchemaVersion, events: [])
}
