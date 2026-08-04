import SwiftUI

@main
struct LitterLogApp: App {
    @StateObject private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(appModel)
                .preferredColorScheme(appModel.preferredColorScheme)
        }
    }
}

struct RootView: View {
    @EnvironmentObject private var appModel: AppModel

    var body: some View {
        NavigationStack {
            HomeView()
        }
        .tint(LitterLogPalette.accent)
        .task {
            appModel.refresh()
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
            appModel.refresh()
        }
    }
}
