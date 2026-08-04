import Foundation

/// Aggregated bathroom activity for a calendar day.
struct TodaySummary: Equatable, Sendable {
    var peeCount: Int
    var pooCount: Int
    var triedCount: Int
    var mostRecentTimestamp: Date?

    static let empty = TodaySummary(peeCount: 0, pooCount: 0, triedCount: 0, mostRecentTimestamp: nil)

    var totalCount: Int { peeCount + pooCount + triedCount }
    var hasEvents: Bool { totalCount > 0 }

    /// Builds a compact summary like "Today: 3 pees · 1 poo · 1 attempt".
    func compactDescription(prefix: String = "Today") -> String {
        let pee = Self.pluralize(peeCount, singular: "pee", plural: "pees")
        let poo = Self.pluralize(pooCount, singular: "poo", plural: "poos")
        let tried = Self.pluralize(triedCount, singular: "attempt", plural: "attempts")
        return "\(prefix): \(pee) · \(poo) · \(tried)"
    }

    static func pluralize(_ count: Int, singular: String, plural: String) -> String {
        "\(count) \(count == 1 ? singular : plural)"
    }

    static func calculate(
        from events: [BathroomEvent],
        on day: Date = .now,
        calendar: Calendar = .current
    ) -> TodaySummary {
        let dayEvents = events.filter { calendar.isDate($0.timestamp, inSameDayAs: day) }
        var pee = 0
        var poo = 0
        var tried = 0
        var mostRecent: Date?

        for event in dayEvents {
            switch event.type {
            case .pee: pee += 1
            case .poo: poo += 1
            case .triedToPee: tried += 1
            }
            if let current = mostRecent {
                if event.timestamp > current {
                    mostRecent = event.timestamp
                }
            } else {
                mostRecent = event.timestamp
            }
        }

        return TodaySummary(
            peeCount: pee,
            pooCount: poo,
            triedCount: tried,
            mostRecentTimestamp: mostRecent
        )
    }
}
