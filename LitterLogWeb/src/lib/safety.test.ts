import { describe, expect, it } from 'vitest'
import { shouldShowSafetyNotice } from './safety'
import { DEFAULT_SETTINGS, type BathroomEvent } from '../models/types'

function tried(id: string, timestamp: string): BathroomEvent {
  return {
    id,
    type: 'triedToPee',
    timestamp,
    createdAt: timestamp,
    note: null,
    source: 'web-app',
    schemaVersion: 1,
  }
}

describe('safety notice throttling', () => {
  it('shows on first tried-to-pee', () => {
    const event = tried('1', '2026-08-04T12:00:00.000Z')
    expect(
      shouldShowSafetyNotice(
        event,
        [event],
        DEFAULT_SETTINGS,
        new Date(event.timestamp),
      ),
    ).toBe(true)
  })

  it('does not show for pee', () => {
    const event: BathroomEvent = {
      id: '1',
      type: 'pee',
      timestamp: '2026-08-04T12:00:00.000Z',
      createdAt: '2026-08-04T12:00:00.000Z',
      note: null,
      source: 'web-app',
      schemaVersion: 1,
    }
    expect(shouldShowSafetyNotice(event, [event], DEFAULT_SETTINGS)).toBe(false)
  })

  it('respects cooldown', () => {
    const now = new Date('2026-08-04T12:00:00.000Z')
    const event = tried('2', now.toISOString())
    const settings = {
      ...DEFAULT_SETTINGS,
      lastSafetyWarningAt: '2026-08-04T11:45:00.000Z',
    }
    expect(
      shouldShowSafetyNotice(
        event,
        [event, tried('1', '2026-08-04T11:50:00.000Z')],
        settings,
        now,
      ),
    ).toBe(false)
  })
})
