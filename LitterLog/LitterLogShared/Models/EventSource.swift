import Foundation

/// Where a bathroom event was created.
enum EventSource: String, Codable, CaseIterable, Sendable {
    case app
    case widget

    var displayName: String {
        switch self {
        case .app: return "App"
        case .widget: return "Widget"
        }
    }
}
