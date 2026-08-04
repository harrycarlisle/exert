import WidgetKit
import SwiftUI
import AppIntents

struct LitterLogWidget: Widget {
    let kind: String = AppGroupConfiguration.widgetKind

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: LitterLogTimelineProvider()) { entry in
            LitterLogWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Litter Log")
        .description("Log pee, poo, or tried-to-pee events with one tap.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct LitterLogTimelineEntry: TimelineEntry {
    let date: Date
    let summary: TodaySummary
    let catName: String
    let latestEvent: BathroomEvent?
    let loadFailed: Bool
}

struct LitterLogTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> LitterLogTimelineEntry {
        LitterLogTimelineEntry(
            date: .now,
            summary: TodaySummary(peeCount: 2, pooCount: 1, triedCount: 0, mostRecentTimestamp: .now),
            catName: "",
            latestEvent: nil,
            loadFailed: false
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (LitterLogTimelineEntry) -> Void) {
        completion(loadEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<LitterLogTimelineEntry>) -> Void) {
        let entry = loadEntry()
        // Refresh periodically so midnight boundaries update counts.
        let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }

    private func loadEntry() -> LitterLogTimelineEntry {
        let store = SharedEventStore.shared
        do {
            let events = try store.fetchEvents()
            let settings = try store.fetchSettings()
            let summary = TodaySummary.calculate(from: events)
            return LitterLogTimelineEntry(
                date: .now,
                summary: summary,
                catName: settings.trimmedCatName,
                latestEvent: events.first,
                loadFailed: false
            )
        } catch {
            return LitterLogTimelineEntry(
                date: .now,
                summary: .empty,
                catName: "",
                latestEvent: nil,
                loadFailed: true
            )
        }
    }
}

struct LitterLogWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    var entry: LitterLogTimelineEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallLitterLogWidgetView(entry: entry)
        default:
            MediumLitterLogWidgetView(entry: entry)
        }
    }
}

struct SmallLitterLogWidgetView: View {
    let entry: LitterLogTimelineEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(entry.catName.isEmpty ? "Litter Log" : entry.catName)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)

            HStack(spacing: 8) {
                WidgetLogButton(type: .pee, intent: LogPeeIntent())
                WidgetLogButton(type: .poo, intent: LogPooIntent())
            }

            HStack {
                WidgetLogButton(type: .triedToPee, intent: LogTriedToPeeIntent(), compact: true)
                Spacer(minLength: 4)
                if entry.loadFailed {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.caption2)
                        .foregroundStyle(LitterLogPalette.tried)
                        .accessibilityLabel("Unable to access shared data")
                } else {
                    Text("\(entry.summary.peeCount)·\(entry.summary.pooCount)·\(entry.summary.triedCount)")
                        .font(.caption2.monospacedDigit())
                        .foregroundStyle(.secondary)
                        .accessibilityLabel(entry.summary.compactDescription())
                }
            }
        }
        .padding(2)
    }
}

struct MediumLitterLogWidgetView: View {
    let entry: LitterLogTimelineEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(entry.catName.isEmpty ? "Litter Log" : entry.catName)
                    .font(.headline)
                Spacer()
                if entry.loadFailed {
                    Text("Shared data unavailable")
                        .font(.caption2)
                        .foregroundStyle(LitterLogPalette.tried)
                } else if let latest = entry.latestEvent {
                    Text("Latest: \(latest.type.shortDisplayName) \(latest.timestamp.formatted(date: .omitted, time: .shortened))")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                } else {
                    Text(entry.summary.compactDescription())
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }

            HStack(spacing: 10) {
                WidgetLogButton(type: .pee, intent: LogPeeIntent(), title: "Pee")
                WidgetLogButton(type: .poo, intent: LogPooIntent(), title: "Poo")
                WidgetLogButton(type: .triedToPee, intent: LogTriedToPeeIntent(), title: "Tried")
            }

            if !entry.loadFailed {
                Text(entry.summary.compactDescription())
                    .font(.caption.weight(.medium))
                    .foregroundStyle(.secondary)
                    .accessibilityLabel(entry.summary.compactDescription())
            }
        }
        .padding(2)
    }
}

struct WidgetLogButton<I: AppIntent>: View {
    let type: BathroomEventType
    let intent: I
    var title: String?
    var compact: Bool = false

    var body: some View {
        Button(intent: intent) {
            VStack(spacing: 4) {
                Image(systemName: type.symbolName)
                    .font(compact ? .caption.weight(.bold) : .body.weight(.bold))
                if let title {
                    Text(title)
                        .font(.caption2.weight(.semibold))
                        .lineLimit(1)
                        .minimumScaleFactor(0.8)
                } else if compact {
                    Text(type.shortDisplayName)
                        .font(.caption2.weight(.semibold))
                        .lineLimit(1)
                }
            }
            .foregroundStyle(type.onColorForeground)
            .frame(maxWidth: .infinity, minHeight: compact ? 36 : 52)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(type.color)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(type.displayName)
        .accessibilityHint(type.accessibilityHint)
    }
}

#Preview("Small", as: .systemSmall) {
    LitterLogWidget()
} timeline: {
    LitterLogTimelineEntry(
        date: .now,
        summary: TodaySummary(peeCount: 3, pooCount: 1, triedCount: 1, mostRecentTimestamp: .now),
        catName: "Mochi",
        latestEvent: SampleData.events().first,
        loadFailed: false
    )
}

#Preview("Medium", as: .systemMedium) {
    LitterLogWidget()
} timeline: {
    LitterLogTimelineEntry(
        date: .now,
        summary: TodaySummary(peeCount: 3, pooCount: 1, triedCount: 1, mostRecentTimestamp: .now),
        catName: "Mochi",
        latestEvent: SampleData.events().first,
        loadFailed: false
    )
}
