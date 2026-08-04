import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var appModel: AppModel
    @Environment(\.openURL) private var openURL

    var focusVetPhone: Bool = false

    @State private var draft: AppSettings = .default
    @State private var showDeleteConfirmation = false
    @State private var showExport = false
    @FocusState private var vetPhoneFocused: Bool

    var body: some View {
        Form {
            Section("Cat") {
                TextField("Cat name (optional)", text: $draft.catName)
                    .textInputAutocapitalization(.words)
            }

            Section("Veterinary contact") {
                TextField("Vet phone (optional)", text: $draft.vetPhoneNumber)
                    .keyboardType(.phonePad)
                    .focused($vetPhoneFocused)
                if draft.hasVetPhone {
                    Button("Call Vet") {
                        callVet(draft.trimmedVetPhone)
                    }
                }
            }

            Section("Preferences") {
                Toggle("Haptics", isOn: $draft.hapticsEnabled)

                Picker("Appearance", selection: $draft.appearance) {
                    ForEach(AppearancePreference.allCases) { option in
                        Text(option.displayName).tag(option)
                    }
                }

                Picker("Default export range", selection: $draft.defaultExportRange) {
                    ForEach(ExportRangePreference.allCases) { option in
                        Text(option.displayName).tag(option)
                    }
                }
            }

            Section("Data") {
                Button {
                    showExport = true
                } label: {
                    Label("Export History", systemImage: "square.and.arrow.up")
                }
            }

            Section {
                Button(role: .destructive) {
                    showDeleteConfirmation = true
                } label: {
                    Label("Delete All History", systemImage: "trash")
                }
            } footer: {
                Text("Deletes every litter record on this device. This cannot be undone after confirmation.")
            }

            Section("Urinary safety") {
                Text(SafetyNoticePolicy.message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Privacy") {
                Text("Your litter records are stored locally on this device. Litter Log does not create an account, track your activity, or upload your records.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("About") {
                LabeledContent("Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                LabeledContent("App Group", value: AppGroupConfiguration.appGroupIdentifier)
                    .font(.caption)
            }
        }
        .navigationTitle("Settings")
        .onAppear {
            draft = appModel.settings
            if focusVetPhone {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    vetPhoneFocused = true
                }
            }
        }
        .onChange(of: draft) { _, newValue in
            appModel.updateSettings(newValue)
        }
        .sheet(isPresented: $showExport) {
            ExportSheetView()
        }
        .confirmationDialog(
            "Delete all history?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Delete All History", role: .destructive) {
                appModel.deleteAllHistory()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently removes every litter record on this device. This cannot be undone.")
        }
    }

    private func callVet(_ phone: String) {
        let digits = phone.filter { $0.isNumber || $0 == "+" }
        guard let url = URL(string: "tel://\(digits)") else { return }
        openURL(url)
    }
}
