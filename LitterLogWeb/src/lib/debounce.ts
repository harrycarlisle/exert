import type { BathroomEventType } from '../models/types'

/** Prevents one physical double-fire from creating duplicates; short enough for intentional rapid taps. */
export const TAP_DEBOUNCE_MS = 350

export class TapDebouncer {
  private lastByType = new Map<BathroomEventType, number>()
  private readonly intervalMs: number

  constructor(intervalMs = TAP_DEBOUNCE_MS) {
    this.intervalMs = intervalMs
  }

  shouldAccept(type: BathroomEventType, now = Date.now()): boolean {
    const last = this.lastByType.get(type)
    if (last !== undefined && now - last < this.intervalMs) {
      return false
    }
    this.lastByType.set(type, now)
    return true
  }

  reset(type?: BathroomEventType): void {
    if (type) {
      this.lastByType.delete(type)
      return
    }
    this.lastByType.clear()
  }
}
