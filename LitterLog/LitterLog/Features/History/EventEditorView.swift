import SwiftUI

struct EventEditorView: View {
    enum Mode {
        case add
        case edit(BathroomEvent)

        var title: String {
            switch self {
            case .add: return "Add Entry"
            case .edit: return "Edit Entry"
            }
        }
    }

    let mode: Mode
    let onSave: (BathroomEvent, Bool) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var type: BathroomEventType = .pee
    @State private var timestamp: Date = .now
    @State private var note: String = ""
    @State private var existingID: UUID?
    @State private var existingSource: EventSource = .app
    @State private var existingCreatedAt: Date = .now

    var body: some View {
        NavigationStack {
            Form {
                Section("Event") {
                    Picker("Type", selection: $type) {
                        ForEach(BathroomEventType.allCases) { eventType in
                            Label(eventType.displayName, systemImage: eventType.symbolName)
                                .tag(eventType)
                        }
                    }

                    DatePicker(
                        "Date & Time",
                        selection: $timestamp,
                        displayedComponents: [.date, .hourAndMinute]
                    )
                }

                Section("Note") {
                    TextField("Optional note", text: $note, axis: .vertical)
                        .lineLimit(3...6)
                }
            }
            .navigationTitle(mode.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") { save() }
                        .fontWeight(.semibold)
                }
            }
            .onAppear(perform: hydrate)
        }
    }

    private func hydrate() {
        switch mode {
        case .add:
            type = .pee
            timestamp = .now
            note = ""
            existingID = nil
            existingSource = .app
            existingCreatedAt = .now
        case .edit(let event):
            type = event.type
            timestamp = event.timestamp
            note = event.note ?? ""
            existingID = event.id
            existingSource = event.source
            existingCreatedAt = event.createdAt
        }
    }

    private func save() {
        let event = BathroomEvent(
            id: existingID ?? UUID(),
            type: type,
            timestamp: timestamp,
            note: note,
            source: existingSource,
            createdAt: existingCreatedAt
        )
        onSave(event, existingID == nil)
        dismiss()
    }
}
