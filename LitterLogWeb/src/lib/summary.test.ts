import { describe, expect, it } from 'vitest'
import { calculateTodaySummary, formatTodaySummary, pluralize } from './summary'
import type { BathroomEvent } from '../models/types'

function event(
  partial: Partial<BathroomEvent> & Pick<BathroomEvent, 'type' | 'timestamp'>,
): BathroomEvent {
  return {
    id: partial.id ?? crypto.randomUUID(),
    type: partial.type,
    timestamp: partial.timestamp,
    createdAt: partial.createdAt ?? partial.timestamp,
    note: partial.note ?? null,
    source: 'web-app',
    schemaVersion: 1,
  }
}

describe('summary language', () => {
  it('handles singular and plural', () => {
    expect(pluralize(1, 'pee', 'pees')).toBe('1 pee')
    expect(pluralize(3, 'pee', 'pees')).toBe('3 pees')
    expect(
      formatTodaySummary({
        peeCount: 1,
        pooCount: 1,
        triedCount: 1,
        mostRecentTimestamp: null,
      }),
    ).toBe('Today: 1 pee · 1 poo · 1 attempt')
    expect(
      formatTodaySummary({
        peeCount: 3,
        pooCount: 2,
        triedCount: 0,
        mostRecentTimestamp: null,
      }),
    ).toBe('Today: 3 pees · 2 poos · 0 attempts')
  })

  it('uses calendar day boundaries', () => {
    const now = new Date(2026, 7, 4, 15, 0, 0)
    const events = [
      event({
        type: 'pee',
        timestamp: new Date(2026, 7, 4, 0, 5).toISOString(),
      }),
      event({
        type: 'pee',
        timestamp: new Date(2026, 7, 4, 23, 50).toISOString(),
      }),
      event({ type: 'poo', timestamp: new Date(2026, 7, 4, 12).toISOString() }),
      event({
        type: 'triedToPee',
        timestamp: new Date(2026, 7, 4, 14).toISOString(),
      }),
      event({ type: 'pee', timestamp: new Date(2026, 7, 3, 12).toISOString() }),
    ]
    const summary = calculateTodaySummary(events, now)
    expect(summary.peeCount).toBe(2)
    expect(summary.pooCount).toBe(1)
    expect(summary.triedCount).toBe(1)
    expect(summary.mostRecentTimestamp).toBe(events[1].timestamp)
  })
})
