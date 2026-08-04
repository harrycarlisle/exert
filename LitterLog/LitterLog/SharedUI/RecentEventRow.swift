import SwiftUI

struct RecentEventRow: View {
    let event: BathroomEvent
    var showsDateWhenNotToday: Bool = true

    private var timeText: String {
        let time = event.timestamp.formatted(date: .omitted, time: .shortened)
        if showsDateWhenNotToday && !Calendar.current.isDateInToday(event.timestamp) {
            let date = event.timestamp.formatted(date: .abbreviated, time: .omitted)
            return "\(date) · \(time)"
        }
        return time
    }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: event.type.symbolName)
                .font(.body.weight(.semibold))
                .foregroundStyle(event.type.onColorForeground)
                .frame(width: 34, height: 34)
                .background(Circle().fill(event.type.color))
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 2) {
                Text(event.type.displayName)
                    .font(.body.weight(.medium))
                Text(timeText)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            if event.hasNote {
                Image(systemName: "note.text")
                    .foregroundStyle(.secondary)
                    .accessibilityLabel("Has note")
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(event.type.displayName), \(timeText)")
    }
}
