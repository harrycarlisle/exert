import Foundation

enum SharedStoreError: LocalizedError, Equatable {
    case appGroupUnavailable
    case readFailed(String)
    case writeFailed(String)
    case decodeFailed
    case encodeFailed
    case eventNotFound

    var errorDescription: String? {
        switch self {
        case .appGroupUnavailable:
            return "Shared storage is unavailable. Check that the App Group entitlement is configured for both the app and widget."
        case .readFailed(let detail):
            return "Could not read litter records. \(detail)"
        case .writeFailed(let detail):
            return "Could not save litter records. \(detail)"
        case .decodeFailed:
            return "Saved litter records could not be understood. Valid data was preserved where possible."
        case .encodeFailed:
            return "Could not prepare litter records for saving."
        case .eventNotFound:
            return "That entry could not be found."
        }
    }
}
