import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var appModel: AppModel

    @State private var filter: HistoryFilter = .all
    @State private var dateRange: HistoryDateRange = .all
    @State private var editorMode: EventEditorView.Mode?
    @State private var eventPendingDeletion: BathroomEvent?
    @State private var showExport = false

    var body: some View {
        List {
            Section {
                Picker("Type", selection: $filter) {
                    ForEach(HistoryFilter.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
                .pickerStyle(.segmented)

                Picker("Date range", selection: $dateRange) {
                    ForEach(HistoryDateRange.allCases) { item in
                        Text(item.title).tag(item)
                    }
                }
            }

            if filteredEvents.isEmpty {
                Section {
                    if appModel.events.isEmpty {
                        ContentUnavailableView(
                            "No history yet",
                            systemImage: "clock",
                            description: Text("Logged events will appear here for you and your veterinarian.")
                        )
                    } else {
                        ContentUnavailableView(
                            "No matches",
                            systemImage: "line.3.horizontal.decrease.circle",
                            description: Text("Nothing matches the current filters. Your history is still saved — try All or a wider date range.")
                        )
                    }
                }
            } else {
                ForEach(sections) { section in
                    Section(section.group.title) {
                        ForEach(section.events) { event in
                            Button {
                                editorMode = .edit(event)
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    RecentEventRow(event: event, showsDateWhenNotToday: false)
                                    HStack {
                                        Text(event.timestamp.formatted(date: .omitted, time: .shortened))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        if event.hasNote {
                                            Text(event.note ?? "")
                                                .font(.caption)
                                                .foregroundStyle(.secondary)
                                                .lineLimit(2)
                                        }
                                    }
                                    .padding(.leading, 46)
                                }
                            }
                            .buttonStyle(.plain)
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) {
                                    eventPendingDeletion = event
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
        }
        .navigationTitle("History")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button {
                        editorMode = .add
                    } label: {
                        Label("Add Entry", systemImage: "plus")
                    }
                    Button {
                        showExport = true
                    } label: {
                        Label("Export CSV", systemImage: "square.and.arrow.up")
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityLabel("History actions")
            }
        }
        .sheet(item: $editorMode) { mode in
            EventEditorView(mode: mode) { event, isNew in
                appModel.save(event: event, isNew: isNew)
            }
        }
        .sheet(isPresented: $showExport) {
            ExportSheetView()
        }
        .confirmationDialog(
            "Delete this entry?",
            isPresented: Binding(
                get: { eventPendingDeletion != nil },
                set: { if !$0 { eventPendingDeletion = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive) {
                if let event = eventPendingDeletion {
                    appModel.delete(event)
                }
                eventPendingDeletion = nil
            }
            Button("Cancel", role: .cancel) {
                eventPendingDeletion = nil
            }
        } message: {
            Text("This cannot be undone.")
        }
    }

    private var filteredEvents: [BathroomEvent] {
        appModel.events.filter { event in
            filter.matches(event) && dateRange.contains(event.timestamp)
        }
    }

    private var sections: [HistorySection] {
        DateGrouping.sections(from: filteredEvents)
    }
}

enum HistoryFilter: String, CaseIterable, Identifiable {
    case all
    case pee
    case poo
    case tried

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "All"
        case .pee: return "Pee"
        case .poo: return "Poo"
        case .tried: return "Tried"
        }
    }

    func matches(_ event: BathroomEvent) -> Bool {
        switch self {
        case .all: return true
        case .pee: return event.type == .pee
        case .poo: return event.type == .poo
        case .tried: return event.type == .triedToPee
        }
    }
}

enum HistoryDateRange: String, CaseIterable, Identifiable {
    case all
    case last7
    case last30
    case last90

    var id: String { rawValue }

    var title: String {
        switch self {
        case .all: return "All dates"
        case .last7: return "Last 7 days"
        case .last30: return "Last 30 days"
        case .last90: return "Last 90 days"
        }
    }

    func contains(_ date: Date, now: Date = .now, calendar: Calendar = .current) -> Bool {
        switch self {
        case .all:
            return true
        case .last7:
            guard let start = calendar.date(byAdding: .day, value: -7, to: now) else { return true }
            return date >= start
        case .last30:
            guard let start = calendar.date(byAdding: .day, value: -30, to: now) else { return true }
            return date >= start
        case .last90:
            guard let start = calendar.date(byAdding: .day, value: -90, to: now) else { return true }
            return date >= start
        }
    }
}

extension EventEditorView.Mode: Identifiable {
    var id: String {
        switch self {
        case .add: return "add"
        case .edit(let event): return event.id.uuidString
        }
    }
}

#Preview("Empty history") {
    NavigationStack {
        HistoryView()
    }
    .environmentObject({
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let store = SharedEventStore(directoryOverride: directory)
        let model = AppModel(store: store)
        model.refresh()
        return model
    }())
}

#Preview("Populated history") {
    NavigationStack {
        HistoryView()
    }
    .environmentObject({
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let store = SharedEventStore(directoryOverride: directory)
        for event in SampleData.events() {
            _ = try? store.insert(event)
        }
        let model = AppModel(store: store)
        model.refresh()
        return model
    }())
}
