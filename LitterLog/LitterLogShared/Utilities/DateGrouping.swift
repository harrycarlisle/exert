import Foundation

enum HistoryDateGroup: Hashable, Identifiable {
    case today
    case yesterday
    case day(Date)

    var id: String {
        switch self {
        case .today: return "today"
        case .yesterday: return "yesterday"
        case .day(let date):
            let formatter = ISO8601DateFormatter()
            formatter.formatOptions = [.withFullDate]
            return formatter.string(from: date)
        }
    }

    var title: String {
        switch self {
        case .today: return "Today"
        case .yesterday: return "Yesterday"
        case .day(let date):
            let formatter = DateFormatter()
            formatter.dateStyle = .full
            formatter.timeStyle = .none
            return formatter.string(from: date)
        }
    }

    static func group(for date: Date, now: Date = .now, calendar: Calendar = .current) -> HistoryDateGroup {
        if calendar.isDateInToday(date) {
            return .today
        }
        if calendar.isDateInYesterday(date) {
            return .yesterday
        }
        let start = calendar.startOfDay(for: date)
        return .day(start)
    }
}

struct HistorySection: Identifiable, Equatable {
    var id: String { group.id }
    var group: HistoryDateGroup
    var events: [BathroomEvent]
}

enum DateGrouping {
    static func sections(
        from events: [BathroomEvent],
        now: Date = .now,
        calendar: Calendar = .current
    ) -> [HistorySection] {
        let sorted = events.sorted { $0.timestamp > $1.timestamp }
        var order: [HistoryDateGroup] = []
        var map: [HistoryDateGroup: [BathroomEvent]] = [:]

        for event in sorted {
            let group = HistoryDateGroup.group(for: event.timestamp, now: now, calendar: calendar)
            if map[group] == nil {
                order.append(group)
                map[group] = []
            }
            map[group, default: []].append(event)
        }

        return order.map { HistorySection(group: $0, events: map[$0] ?? []) }
    }
}
