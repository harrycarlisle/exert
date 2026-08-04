export function playImpactHaptic(enabled: boolean): void {
  if (!enabled) return
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(12)
    }
  } catch {
    // Ignore unsupported environments.
  }
}

export function playSuccessHaptic(enabled: boolean): void {
  if (!enabled) return
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([10, 30, 10])
    }
  } catch {
    // Ignore unsupported environments.
  }
}

export function playErrorHaptic(enabled: boolean): void {
  if (!enabled) return
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([30, 40, 30])
    }
  } catch {
    // Ignore unsupported environments.
  }
}
