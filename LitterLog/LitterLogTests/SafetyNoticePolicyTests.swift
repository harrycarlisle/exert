import XCTest
@testable import LitterLog

final class SafetyNoticePolicyTests: XCTestCase {
    func testShowsOnFirstTriedToPee() {
        let policy = SafetyNoticePolicy()
        let event = BathroomEvent(type: .triedToPee, source: .app)
        let settings = AppSettings.default
        XCTAssertTrue(policy.shouldShowWarning(afterRecording: event, allEvents: [event], settings: settings))
    }

    func testDoesNotShowForPee() {
        let policy = SafetyNoticePolicy()
        let event = BathroomEvent(type: .pee, source: .app)
        XCTAssertFalse(policy.shouldShowWarning(afterRecording: event, allEvents: [event], settings: .default))
    }

    func testRespectsCooldown() {
        var policy = SafetyNoticePolicy()
        policy.minimumCooldown = 60
        policy.attemptThreshold = 2
        policy.repeatWindow = 3600

        let now = Date()
        let event = BathroomEvent(type: .triedToPee, timestamp: now, source: .app)
        var settings = AppSettings.default
        settings.lastSafetyWarningDate = now.addingTimeInterval(-30)

        XCTAssertFalse(policy.shouldShowWarning(
            afterRecording: event,
            allEvents: [event, event],
            settings: settings,
            now: now
        ))
    }
}
