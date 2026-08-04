import Foundation

/// Builds veterinary-friendly CSV exports from bathroom events.
struct CSVExporter: Sendable {
    struct ExportOptions: Sendable {
        var startDate: Date?
        var endDate: Date?
        /// Inclusive end-of-day clipping when only a calendar day range is selected.
        var calendar: Calendar = .current

        static let all = ExportOptions(startDate: nil, endDate: nil)
    }

    private let isoFormatter: ISO8601DateFormatter
    private let dateFormatter: DateFormatter
    private let timeFormatter: DateFormatter

    init(locale: Locale = .current, timeZone: TimeZone = .current) {
        let iso = ISO8601DateFormatter()
        iso.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        self.isoFormatter = iso

        let date = DateFormatter()
        date.locale = locale
        date.timeZone = timeZone
        date.dateStyle = .short
        date.timeStyle = .none
        self.dateFormatter = date

        let time = DateFormatter()
        time.locale = locale
        time.timeZone = timeZone
        time.dateStyle = .none
        time.timeStyle = .medium
        self.timeFormatter = time
    }

    func export(
        events: [BathroomEvent],
        options: ExportOptions = .all
    ) -> String {
        let filtered = filter(events: events, options: options)
            .sorted { $0.timestamp < $1.timestamp }

        var lines: [String] = []
        lines.append(csvLine(["Date", "Time", "Timestamp", "Event Type", "Note", "Recorded From"]))

        for event in filtered {
            let row = [
                dateFormatter.string(from: event.timestamp),
                timeFormatter.string(from: event.timestamp),
                isoFormatter.string(from: event.timestamp),
                event.type.displayName,
                event.note ?? "",
                event.source.displayName
            ]
            lines.append(csvLine(row))
        }

        return lines.joined(separator: "\n") + "\n"
    }

    func suggestedFilename(for date: Date = .now, calendar: Calendar = .current) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        let year = components.year ?? 0
        let month = components.month ?? 0
        let day = components.day ?? 0
        return String(format: "Litter-Log-%04d-%02d-%02d.csv", year, month, day)
    }

    func filter(events: [BathroomEvent], options: ExportOptions) -> [BathroomEvent] {
        events.filter { event in
            if let start = options.startDate, event.timestamp < start {
                return false
            }
            if let end = options.endDate, event.timestamp > end {
                return false
            }
            return true
        }
    }

    /// RFC 4180-style escaping for commas, quotes, and line breaks.
    func escapeField(_ field: String) -> String {
        let needsQuoting =
            field.contains(",")
            || field.contains("\"")
            || field.contains("\n")
            || field.contains("\r")
        guard needsQuoting else { return field }
        let escaped = field.replacingOccurrences(of: "\"", with: "\"\"")
        return "\"\(escaped)\""
    }

    private func csvLine(_ fields: [String]) -> String {
        fields.map(escapeField).joined(separator: ",")
    }
}
