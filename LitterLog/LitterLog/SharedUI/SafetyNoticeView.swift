import SwiftUI

struct SafetyNoticeView: View {
    let hasVetPhone: Bool
    let onDismiss: () -> Void
    let onCallVet: () -> Void
    let onAddVetNumber: () -> Void

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 20) {
                Label("Urinary Safety", systemImage: "exclamationmark.triangle.fill")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(LitterLogPalette.tried)

                Text(SafetyNoticePolicy.message)
                    .font(.body)
                    .foregroundStyle(.primary)
                    .fixedSize(horizontal: false, vertical: true)

                Text("This notice is informational and does not diagnose your cat or replace veterinary care.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                Spacer()

                VStack(spacing: 12) {
                    if hasVetPhone {
                        Button("Call Vet", action: onCallVet)
                            .buttonStyle(.borderedProminent)
                            .tint(LitterLogPalette.tried)
                            .frame(maxWidth: .infinity)
                    } else {
                        Button("Add Vet Number", action: onAddVetNumber)
                            .buttonStyle(.borderedProminent)
                            .tint(LitterLogPalette.accent)
                            .frame(maxWidth: .infinity)
                    }

                    Button("Dismiss", action: onDismiss)
                        .buttonStyle(.bordered)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(24)
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium, .large])
    }
}
