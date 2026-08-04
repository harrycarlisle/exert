import SwiftUI

struct ExportSheetView: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.dismiss) private var dismiss

    @State private var range: ExportRangePreference = .all
    @State private var shareURL: URL?
    @State private var errorMessage: String?
    @State private var isExporting = false

    private let exporter = CSVExporter()

    var body: some View {
        NavigationStack {
            Form {
                Section("Range") {
                    Picker("Export range", selection: $range) {
                        ForEach(ExportRangePreference.allCases) { option in
                            Text(option.displayName).tag(option)
                        }
                    }
                    .pickerStyle(.inline)
                }

                Section {
                    Button {
                        export()
                    } label: {
                        if isExporting {
                            ProgressView()
                                .frame(maxWidth: .infinity)
                        } else {
                            Label("Export CSV", systemImage: "square.and.arrow.up")
                                .frame(maxWidth: .infinity)
                        }
                    }
                    .disabled(isExporting)
                } footer: {
                    Text("Exports stay on this device until you choose where to share them. Nothing is uploaded automatically.")
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(LitterLogPalette.destructive)
                    }
                }
            }
            .navigationTitle("Export")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
            .onAppear {
                range = appModel.settings.defaultExportRange
            }
            .sheet(isPresented: Binding(
                get: { shareURL != nil },
                set: { if !$0 { cleanupShareFile(); shareURL = nil } }
            )) {
                if let shareURL {
                    ActivityView(activityItems: [shareURL])
                }
            }
        }
    }

    private func export() {
        isExporting = true
        errorMessage = nil
        defer { isExporting = false }

        do {
            let events = appModel.allEventsForExport()
            let options = CSVExporter.ExportOptions(
                startDate: range.startDate(),
                endDate: nil
            )
            let csv = exporter.export(events: events, options: options)
            let filename = exporter.suggestedFilename()
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)
            if FileManager.default.fileExists(atPath: url.path) {
                try FileManager.default.removeItem(at: url)
            }
            try csv.write(to: url, atomically: true, encoding: .utf8)
            shareURL = url
        } catch {
            errorMessage = "Could not create the export file. Please try again."
        }
    }

    private func cleanupShareFile() {
        guard let shareURL else { return }
        try? FileManager.default.removeItem(at: shareURL)
    }
}

struct ActivityView: UIViewControllerRepresentable {
    let activityItems: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: activityItems, applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}
