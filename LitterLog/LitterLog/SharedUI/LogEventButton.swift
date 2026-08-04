import SwiftUI

struct LogEventButton: View {
    let type: BathroomEventType
    var size: CGFloat = 132
    var isCompact: Bool = false
    let action: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isPressed = false

    var body: some View {
        Button {
            action()
        } label: {
            VStack(spacing: isCompact ? 8 : 10) {
                Image(systemName: type.symbolName)
                    .font(.system(size: isCompact ? 28 : 34, weight: .semibold))
                Text(type.displayName)
                    .font(.system(size: isCompact ? 15 : 17, weight: .semibold, design: .rounded))
                    .multilineTextAlignment(.center)
                    .minimumScaleFactor(0.8)
                    .lineLimit(2)
            }
            .foregroundStyle(type.onColorForeground)
            .frame(width: size, height: size)
            .background(
                Circle()
                    .fill(type.color)
                    .shadow(color: type.color.opacity(0.35), radius: isPressed ? 2 : 8, y: isPressed ? 1 : 4)
            )
            .scaleEffect(isPressed && !reduceMotion ? 0.94 : 1)
            .animation(reduceMotion ? nil : .easeOut(duration: 0.12), value: isPressed)
        }
        .buttonStyle(PressableButtonStyle(isPressed: $isPressed))
        .accessibilityLabel(type.displayName)
        .accessibilityHint(type.accessibilityHint)
        .frame(minWidth: 44, minHeight: 44)
    }
}

private struct PressableButtonStyle: ButtonStyle {
    @Binding var isPressed: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .onChange(of: configuration.isPressed) { _, newValue in
                isPressed = newValue
            }
    }
}

#Preview("Log buttons") {
    HStack(spacing: 20) {
        LogEventButton(type: .pee, action: {})
        LogEventButton(type: .poo, action: {})
    }
    .padding()
}
