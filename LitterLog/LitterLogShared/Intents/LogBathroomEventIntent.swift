import AppIntents
import WidgetKit

enum BathroomEventLogger {
    @MainActor
    static func log(_ type: BathroomEventType, source: EventSource = .widget) throws -> String {
        let store = SharedEventStore.shared
        _ = try store.insert(type: type, source: source)
        WidgetCenter.shared.reloadTimelines(ofKind: AppGroupConfiguration.widgetKind)
        let time = Date.now.formatted(date: .omitted, time: .shortened)
        return "\(type.displayName) recorded at \(time)"
    }
}

/// Interactive widget / Shortcuts intent that records one bathroom event.
struct LogBathroomEventIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Bathroom Event"
    static var description = IntentDescription("Records a litter box event with the current time.")
    static var openAppWhenRun: Bool = false

    @Parameter(title: "Event Type")
    var eventType: BathroomEventTypeAppEnum

    init() {
        self.eventType = .pee
    }

    init(eventType: BathroomEventTypeAppEnum) {
        self.eventType = eventType
    }

    init(type: BathroomEventType) {
        self.eventType = BathroomEventTypeAppEnum(type)
    }

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let message = try BathroomEventLogger.log(eventType.modelType, source: .widget)
        return .result(dialog: IntentDialog(stringLiteral: message))
    }
}

/// App Enum bridge so App Intents can parameterize event types cleanly.
enum BathroomEventTypeAppEnum: String, AppEnum {
    case pee
    case poo
    case triedToPee

    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Bathroom Event Type")

    static var caseDisplayRepresentations: [BathroomEventTypeAppEnum: DisplayRepresentation] = [
        .pee: DisplayRepresentation(title: "Pee", subtitle: "Successful urination"),
        .poo: DisplayRepresentation(title: "Poo", subtitle: "Defecation"),
        .triedToPee: DisplayRepresentation(title: "Tried to Pee", subtitle: "Little or no urine")
    ]

    init(_ type: BathroomEventType) {
        switch type {
        case .pee: self = .pee
        case .poo: self = .poo
        case .triedToPee: self = .triedToPee
        }
    }

    var modelType: BathroomEventType {
        switch self {
        case .pee: return .pee
        case .poo: return .poo
        case .triedToPee: return .triedToPee
        }
    }
}

struct LogPeeIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Pee"
    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let message = try BathroomEventLogger.log(.pee, source: .widget)
        return .result(dialog: IntentDialog(stringLiteral: message))
    }
}

struct LogPooIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Poo"
    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let message = try BathroomEventLogger.log(.poo, source: .widget)
        return .result(dialog: IntentDialog(stringLiteral: message))
    }
}

struct LogTriedToPeeIntent: AppIntent {
    static var title: LocalizedStringResource = "Log Tried to Pee"
    static var openAppWhenRun: Bool = false

    @MainActor
    func perform() async throws -> some IntentResult & ProvidesDialog {
        let message = try BathroomEventLogger.log(.triedToPee, source: .widget)
        return .result(dialog: IntentDialog(stringLiteral: message))
    }
}
