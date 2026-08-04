import Foundation

/// Decides when the urinary safety notice should appear after a "Tried to Pee" event.
///
/// Logging is never delayed by this policy — callers must save the event first.
struct SafetyNoticePolicy: Sendable {
    /// Show again if multiple attempts occur within this window after the last warning.
    var repeatWindow: TimeInterval = 6 * 60 * 60
    /// Minimum attempts in the window (including the newest) before re-showing.
    var attemptThreshold: Int = 2
    /// Do not show more often than this cooldown after a dismissal, unless threshold is hit.
    var minimumCooldown: TimeInterval = 30 * 60

    static let shared = SafetyNoticePolicy()

    static let message = """
    Repeated straining with little or no urine can be an emergency, especially in male cats. Contact a veterinarian or emergency clinic immediately if your cat is repeatedly trying to urinate, producing little or no urine, crying, vomiting, hiding, or appearing distressed.
    """

    func shouldShowWarning(
        afterRecording event: BathroomEvent,
        allEvents: [BathroomEvent],
        settings: AppSettings,
        now: Date = .now
    ) -> Bool {
        guard event.type == .triedToPee else { return false }

        // First ever "Tried to Pee" recording.
        if settings.lastSafetyWarningDate == nil {
            let triedCount = allEvents.filter { $0.type == .triedToPee }.count
            return triedCount >= 1
        }

        guard let lastWarning = settings.lastSafetyWarningDate else { return false }

        // Avoid constant alerts after every tap.
        if now.timeIntervalSince(lastWarning) < minimumCooldown {
            return false
        }

        let windowStart = now.addingTimeInterval(-repeatWindow)
        let recentAttempts = allEvents.filter {
            $0.type == .triedToPee && $0.timestamp >= windowStart && $0.timestamp <= now
        }

        return recentAttempts.count >= attemptThreshold
            && now.timeIntervalSince(lastWarning) >= minimumCooldown
    }
}
