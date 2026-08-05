import type { AppSettings, BathroomEvent } from '../models/types'
import { parseISO } from './dates'

const REPEAT_WINDOW_MS = 6 * 60 * 60 * 1000
const MIN_COOLDOWN_MS = 30 * 60 * 1000
const ATTEMPT_THRESHOLD = 2

/** Call only after a Tried to Pee event has already been saved. */
export function shouldShowSafetyNotice(
  event: BathroomEvent,
  allEvents: BathroomEvent[],
  settings: AppSettings,
  now = new Date(),
): boolean {
  if (event.type !== 'triedToPee') return false

  const animalEvents = allEvents.filter(
    (item) => item.animalId === event.animalId,
  )

  if (!settings.lastSafetyWarningAt) {
    return animalEvents.some((e) => e.type === 'triedToPee')
  }

  const lastWarning = parseISO(settings.lastSafetyWarningAt).getTime()
  const nowMs = now.getTime()
  if (nowMs - lastWarning < MIN_COOLDOWN_MS) return false

  const windowStart = nowMs - REPEAT_WINDOW_MS
  const recentAttempts = animalEvents.filter((e) => {
    if (e.type !== 'triedToPee') return false
    const t = parseISO(e.timestamp).getTime()
    return t >= windowStart && t <= nowMs
  })

  return recentAttempts.length >= ATTEMPT_THRESHOLD
}
