import SwiftUI

/// The three bathroom event types tracked by Litter Log.
enum BathroomEventType: String, Codable, CaseIterable, Identifiable, Sendable {
    case pee
    case poo
    case triedToPee

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .pee: return "Pee"
        case .poo: return "Poo"
        case .triedToPee: return "Tried to Pee"
        }
    }

    /// Compact label for constrained widget layouts.
    var shortDisplayName: String {
        switch self {
        case .pee: return "Pee"
        case .poo: return "Poo"
        case .triedToPee: return "Tried"
        }
    }

    var symbolName: String {
        switch self {
        case .pee: return "drop.fill"
        case .poo: return "circle.fill"
        case .triedToPee: return "exclamationmark.triangle.fill"
        }
    }

    var accessibilityHint: String {
        switch self {
        case .pee: return "Records that the cat successfully urinated"
        case .poo: return "Records that the cat defecated"
        case .triedToPee: return "Records that the cat tried to urinate with little or no urine"
        }
    }

    var color: Color {
        switch self {
        case .pee: return LitterLogPalette.pee
        case .poo: return LitterLogPalette.poo
        case .triedToPee: return LitterLogPalette.tried
        }
    }

    /// High-contrast foreground for text/icons drawn on the event color.
    var onColorForeground: Color {
        switch self {
        case .pee: return Color(red: 0.25, green: 0.18, blue: 0.05)
        case .poo: return .white
        case .triedToPee: return .white
        }
    }
}
