import SwiftUI
import UIKit
import WidgetKit

@MainActor
final class AppModel: ObservableObject {
    @Published private(set) var events: [BathroomEvent] = []
    @Published private(set) var settings: AppSettings = .default
    @Published private(set) var todaySummary: TodaySummary = .empty
    @Published var confirmationMessage: String?
    @Published var undoEventID: UUID?
    @Published var errorMessage: String?
    @Published var showSafetyNotice = false
    @Published private(set) var loadFailed = false

    private let store: SharedEventStore
    private let safetyPolicy: SafetyNoticePolicy
    private var lastTapDates: [BathroomEventType: Date] = [:]
    private let debounceInterval: TimeInterval = 0.35

    init(
        store: SharedEventStore = .shared,
        safetyPolicy: SafetyNoticePolicy = .shared
    ) {
        self.store = store
        self.safetyPolicy = safetyPolicy
    }

    var preferredColorScheme: ColorScheme? {
        switch settings.appearance {
        case .system: return nil
        case .light: return .light
        case .dark: return .dark
        }
    }

    var recentEvents: [BathroomEvent] {
        Array(events.prefix(5))
    }

    var displayTitleSubtitle: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .full
        formatter.timeStyle = .none
        let today = formatter.string(from: Date())
        if settings.hasCatName {
            return "\(settings.trimmedCatName) · \(today)"
        }
        return today
    }

    func refresh() {
        do {
            events = try store.fetchEvents()
            settings = try store.fetchSettings()
            todaySummary = TodaySummary.calculate(from: events)
            loadFailed = false
            errorMessage = nil
        } catch {
            loadFailed = true
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
    }

    @discardableResult
    func log(_ type: BathroomEventType, source: EventSource = .app) -> BathroomEvent? {
        // Short UI debounce to ignore accidental double-delivery of one physical tap.
        if let last = lastTapDates[type], Date().timeIntervalSince(last) < debounceInterval {
            return nil
        }
        lastTapDates[type] = Date()

        do {
            let event = try store.insert(type: type, source: source)
            refresh()
            let time = event.timestamp.formatted(date: .omitted, time: .shortened)
            confirmationMessage = "\(type.displayName) recorded at \(time)"
            undoEventID = event.id
            errorMessage = nil
            playSuccessHaptic()

            if safetyPolicy.shouldShowWarning(afterRecording: event, allEvents: events, settings: settings) {
                showSafetyNotice = true
            }
            return event
        } catch {
            confirmationMessage = nil
            undoEventID = nil
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Could not save that entry."
            playErrorHaptic()
            return nil
        }
    }

    func undoLastIfMatching() {
        guard let id = undoEventID else { return }
        do {
            try store.delete(id: id)
            undoEventID = nil
            confirmationMessage = "Entry undone"
            refresh()
            playSelectionHaptic()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Could not undo that entry."
        }
    }

    func delete(_ event: BathroomEvent) {
        do {
            try store.delete(id: event.id)
            if undoEventID == event.id {
                undoEventID = nil
                confirmationMessage = nil
            }
            refresh()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Could not delete that entry."
        }
    }

    func save(event: BathroomEvent, isNew: Bool) {
        do {
            if isNew {
                _ = try store.insert(event)
            } else {
                try store.update(event)
            }
            refresh()
            playSuccessHaptic()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Could not save changes."
            playErrorHaptic()
        }
    }

    func updateSettings(_ newSettings: AppSettings) {
        do {
            try store.saveSettings(newSettings)
            settings = newSettings
            reloadWidgetOnly()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Could not save settings."
        }
    }

    func markSafetyNoticeShown() {
        var updated = settings
        updated.lastSafetyWarningDate = Date()
        updateSettings(updated)
        showSafetyNotice = false
    }

    func deleteAllHistory() {
        do {
            try store.deleteAll()
            undoEventID = nil
            confirmationMessage = nil
            refresh()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Could not delete history."
        }
    }

    func allEventsForExport() -> [BathroomEvent] {
        events.sorted { $0.timestamp < $1.timestamp }
    }

    private func reloadWidgetOnly() {
        WidgetCenter.shared.reloadTimelines(ofKind: AppGroupConfiguration.widgetKind)
    }

    private func playSuccessHaptic() {
        guard settings.hapticsEnabled else { return }
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
    }

    private func playErrorHaptic() {
        guard settings.hapticsEnabled else { return }
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }

    private func playSelectionHaptic() {
        guard settings.hapticsEnabled else { return }
        let generator = UISelectionFeedbackGenerator()
        generator.selectionChanged()
    }

    func playPressHaptic() {
        guard settings.hapticsEnabled else { return }
        let generator = UIImpactFeedbackGenerator(style: .medium)
        generator.impactOccurred()
    }
}
