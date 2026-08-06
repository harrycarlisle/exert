import { describe, expect, it } from 'vitest'
import {
  calculateTodaySummary,
  formatTodayHeading,
  formatTodayStat,
  formatTodaySummary,
  pluralize,
} from './summary'
import type { BathroomEvent } from '../models/types'

function event(
  partial: Partial<BathroomEvent> &
    Pick<BathroomEvent, 'type' | 'timestamp' | 'animalId'>,
): BathroomEvent {
  return {
    id: partial.id ?? crypto.randomUUID(),
    animalId: partial.animalId,
    type: partial.type,
    timestamp: partial.timestamp,
    createdAt: partial.createdAt ?? partial.timestamp,
    note: partial.note ?? null,
    source: 'web-app',
    schemaVersion: 2,
  }
}

describe('summary language', () => {
  it('handles singular and plural compact stats for all event types', () => {
    expect(pluralize(1, 'pee', 'pees')).toBe('1 pee')
    expect(pluralize(3, 'pee', 'pees')).toBe('3 pees')
    expect(formatTodayHeading('Bower')).toBe('Today · Bower')
    expect(formatTodayStat(1, 'Pee', 'Pees')).toBe('1 Pee')
    expect(formatTodayStat(0, 'Poo', 'Poos')).toBe('0 Poos')
    expect(formatTodayStat(2, 'Tried', 'Tried')).toBe('2 Tried')
    expect(
      formatTodaySummary({
        peeCount: 1,
        pooCount: 1,
        vomitCount: 1,
        hairballCount: 1,
        triedCount: 1,
        mostRecentTimestamp: null,
      }),
    ).toBe('Today: 1 Pee · 1 Poo · 1 Vomit · 1 Hairball · 1 Tried')
    expect(
      formatTodaySummary(
        {
          peeCount: 2,
          pooCount: 1,
          vomitCount: 0,
          hairballCount: 3,
          triedCount: 0,
          mostRecentTimestamp: null,
        },
        'Cleo',
      ),
    ).toBe('Today · Cleo: 2 Pees · 1 Poo · 0 Vomits · 3 Hairballs · 0 Tried')
  })

  it('uses calendar day boundaries and selected animal', () => {
    const now = new Date(2026, 7, 4, 15, 0, 0)
    const events = [
      event({
        animalId: 'cleo',
        type: 'pee',
        timestamp: new Date(2026, 7, 4, 0, 5).toISOString(),
      }),
      event({
        animalId: 'cleo',
        type: 'pee',
        timestamp: new Date(2026, 7, 4, 23, 50).toISOString(),
      }),
      event({
        animalId: 'bower',
        type: 'poo',
        timestamp: new Date(2026, 7, 4, 12).toISOString(),
      }),
      event({
        animalId: 'cleo',
        type: 'triedToPee',
        timestamp: new Date(2026, 7, 4, 14).toISOString(),
      }),
      event({
        animalId: 'cleo',
        type: 'vomit',
        note: 'Grass',
        timestamp: new Date(2026, 7, 4, 13).toISOString(),
      }),
      event({
        animalId: 'cleo',
        type: 'hairball',
        timestamp: new Date(2026, 7, 4, 16).toISOString(),
      }),
      event({
        animalId: 'cleo',
        type: 'pee',
        timestamp: new Date(2026, 7, 3, 12).toISOString(),
      }),
    ]
    const cleoSummary = calculateTodaySummary(events, now, 'cleo')
    expect(cleoSummary.peeCount).toBe(2)
    expect(cleoSummary.pooCount).toBe(0)
    expect(cleoSummary.vomitCount).toBe(1)
    expect(cleoSummary.hairballCount).toBe(1)
    expect(cleoSummary.triedCount).toBe(1)
    const bowerSummary = calculateTodaySummary(events, now, 'bower')
    expect(bowerSummary.pooCount).toBe(1)
    expect(bowerSummary.peeCount).toBe(0)
  })
})
