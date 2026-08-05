import type { BathroomEventType } from '../models/types'

/** Prevents one physical double-fire from creating duplicates; short enough for intentional rapid taps. */
export const TAP_DEBOUNCE_MS = 350

function keyFor(animalId: string, type: BathroomEventType): string {
  return `${animalId}:${type}`
}

export class TapDebouncer {
  private lastByKey = new Map<string, number>()
  private readonly intervalMs: number

  constructor(intervalMs = TAP_DEBOUNCE_MS) {
    this.intervalMs = intervalMs
  }

  shouldAccept(
    type: BathroomEventType,
    now = Date.now(),
    animalId = 'default',
  ): boolean {
    const key = keyFor(animalId, type)
    const last = this.lastByKey.get(key)
    if (last !== undefined && now - last < this.intervalMs) {
      return false
    }
    this.lastByKey.set(key, now)
    return true
  }

  reset(type?: BathroomEventType, animalId?: string): void {
    if (type && animalId) {
      this.lastByKey.delete(keyFor(animalId, type))
      return
    }
    if (type) {
      for (const key of [...this.lastByKey.keys()]) {
        if (key.endsWith(`:${type}`)) this.lastByKey.delete(key)
      }
      return
    }
    this.lastByKey.clear()
  }
}
