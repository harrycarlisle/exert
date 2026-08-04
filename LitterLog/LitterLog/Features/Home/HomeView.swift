import SwiftUI

struct HomeView: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.openURL) private var openURL

    @State private var showHistory = false
    @State private var showSettings = false
    @State private var navigateToSettingsFromSafety = false
    @State private var eventPendingDeletion: BathroomEvent?

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                header
                loggingControls
                todaySummaryCard
                recentActivity
            }
            .padding(.horizontal, 20)
            .padding(.bottom, 28)
        }
        .background(Color(.systemGroupedBackground).ignoresSafeArea())
        .navigationTitle("Litter Log")
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack(spacing: 12) {
                    Button {
                        showHistory = true
                    } label: {
                        Image(systemName: "clock.arrow.circlepath")
                    }
                    .accessibilityLabel("History")

                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gearshape")
                    }
                    .accessibilityLabel("Settings")
                }
            }
        }
        .navigationDestination(isPresented: $showHistory) {
            HistoryView()
        }
        .navigationDestination(isPresented: $showSettings) {
            SettingsView()
        }
        .navigationDestination(isPresented: $navigateToSettingsFromSafety) {
            SettingsView(focusVetPhone: true)
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
        .safeAreaInset(edge: .bottom) {
            if appModel.confirmationMessage != nil || appModel.errorMessage != nil {
                statusBanner
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: appModel.confirmationMessage)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.2), value: appModel.errorMessage)
        .sheet(isPresented: $appModel.showSafetyNotice) {
            SafetyNoticeView(
                hasVetPhone: appModel.settings.hasVetPhone,
                onDismiss: {
                    appModel.markSafetyNoticeShown()
                },
                onCallVet: {
                    appModel.markSafetyNoticeShown()
                    callVet()
                },
                onAddVetNumber: {
                    appModel.markSafetyNoticeShown()
                    navigateToSettingsFromSafety = true
                }
            )
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(appModel.displayTitleSubtitle)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityLabel(appModel.displayTitleSubtitle)
        }
    }

    private var loggingControls: some View {
        VStack(spacing: 18) {
            HStack(spacing: 20) {
                LogEventButton(type: .pee) {
                    appModel.playPressHaptic()
                    _ = appModel.log(.pee)
                }
                LogEventButton(type: .poo) {
                    appModel.playPressHaptic()
                    _ = appModel.log(.poo)
                }
            }

            LogEventButton(type: .triedToPee, size: 112, isCompact: true) {
                appModel.playPressHaptic()
                _ = appModel.log(.triedToPee)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 4)
    }

    private var todaySummaryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(appModel.todaySummary.compactDescription())
                .font(.headline)
                .accessibilityLabel(appModel.todaySummary.compactDescription())
                .accessibilityValue(
                    "\(appModel.todaySummary.peeCount) pees, \(appModel.todaySummary.pooCount) poos, \(appModel.todaySummary.triedCount) attempts"
                )

            if let recent = appModel.todaySummary.mostRecentTimestamp {
                Text("Latest at \(recent.formatted(date: .omitted, time: .shortened))")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else if !appModel.loadFailed {
                Text("No events today yet")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            if appModel.loadFailed {
                Text(appModel.errorMessage ?? "Could not load records.")
                    .font(.footnote)
                    .foregroundStyle(LitterLogPalette.destructive)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var recentActivity: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Recent")
                    .font(.title3.weight(.semibold))
                Spacer()
                Button("View All History") {
                    showHistory = true
                }
                .font(.subheadline.weight(.semibold))
            }

            if appModel.recentEvents.isEmpty {
                ContentUnavailableView(
                    "No history yet",
                    systemImage: "pawprint",
                    description: Text("Tap Pee, Poo, or Tried to Pee to start logging.")
                )
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
            } else {
                VStack(spacing: 0) {
                    ForEach(appModel.recentEvents) { event in
                        RecentEventRow(event: event)
                            .padding(.vertical, 8)
                            .contentShape(Rectangle())
                            .contextMenu {
                                Button(role: .destructive) {
                                    eventPendingDeletion = event
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                            }
                            .accessibilityAction(named: "Delete") {
                                eventPendingDeletion = event
                            }
                        if event.id != appModel.recentEvents.last?.id {
                            Divider()
                        }
                    }
                }
                .padding(12)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
        }
    }

    private var statusBanner: some View {
        HStack(spacing: 12) {
            if let error = appModel.errorMessage, appModel.confirmationMessage == nil {
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundStyle(LitterLogPalette.destructive)
                Text(error)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                Spacer(minLength: 0)
                Button("Retry") {
                    if let last = inferRetryType() {
                        _ = appModel.log(last)
                    } else {
                        appModel.refresh()
                    }
                }
                .font(.subheadline.weight(.semibold))
            } else if let message = appModel.confirmationMessage {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(LitterLogPalette.accent)
                Text(message)
                    .font(.subheadline)
                Spacer(minLength: 0)
                if appModel.undoEventID != nil {
                    Button("Undo") {
                        appModel.undoLastIfMatching()
                    }
                    .font(.subheadline.weight(.semibold))
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial, in: Capsule())
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
    }

    private func inferRetryType() -> BathroomEventType? {
        // Retry after a failed save is most useful immediately after a tap attempt.
        nil
    }

    private func callVet() {
        let digits = appModel.settings.trimmedVetPhone.filter { $0.isNumber || $0 == "+" }
        guard let url = URL(string: "tel://\(digits)") else { return }
        openURL(url)
    }
}

#Preview("Empty home") {
    NavigationStack {
        HomeView()
    }
    .environmentObject(previewModel(events: [], settings: .default))
}

#Preview("Populated home") {
    NavigationStack {
        HomeView()
    }
    .environmentObject(previewModel(events: SampleData.events(), settings: SampleData.settingsWithCat))
}

#Preview("Dark mode") {
    NavigationStack {
        HomeView()
    }
    .environmentObject(previewModel(events: SampleData.events(), settings: SampleData.settingsWithCat))
    .preferredColorScheme(.dark)
}

#Preview("Large Dynamic Type") {
    NavigationStack {
        HomeView()
    }
    .environmentObject(previewModel(events: SampleData.events(), settings: .default))
    .environment(\.sizeCategory, .accessibilityExtraExtraLarge)
}

@MainActor
private func previewModel(events: [BathroomEvent], settings: AppSettings) -> AppModel {
    let directory = FileManager.default.temporaryDirectory
        .appendingPathComponent("LitterLogPreview-\(UUID().uuidString)", isDirectory: true)
    let store = SharedEventStore(directoryOverride: directory)
    try? store.saveSettings(settings)
    for event in events {
        _ = try? store.insert(event)
    }
    let model = AppModel(store: store)
    model.refresh()
    return model
}
