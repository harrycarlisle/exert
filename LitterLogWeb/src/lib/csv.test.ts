import { describe, expect, it } from 'vitest'
import { csvFilename, escapeCsvField, eventsToCsv } from './csv'
import type { BathroomEvent } from '../models/types'

describe('csv', () => {
  it('escapes commas, quotes, and line breaks', () => {
    expect(escapeCsvField('plain')).toBe('plain')
    expect(escapeCsvField('hello, world')).toBe('"hello, world"')
    expect(escapeCsvField('she said "hi"')).toBe('"she said ""hi"""')
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('sorts oldest to newest and escapes notes', () => {
    const events: BathroomEvent[] = [
      {
        id: '2',
        type: 'poo',
        timestamp: '2026-08-04T18:00:00.000Z',
        createdAt: '2026-08-04T18:00:00.000Z',
        note: 'second, with comma',
        source: 'web-app',
        schemaVersion: 1,
      },
      {
        id: '1',
        type: 'pee',
        timestamp: '2026-08-04T10:00:00.000Z',
        createdAt: '2026-08-04T10:00:00.000Z',
        note: 'first',
        source: 'web-app',
        schemaVersion: 1,
      },
    ]
    const csv = eventsToCsv(events)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toContain('ISO 8601 Timestamp')
    expect(lines[1]).toContain('Pee')
    expect(lines[2]).toContain('Poo')
    expect(lines[2]).toContain('"second, with comma"')
    expect(lines[2]).toContain('Web App')
  })

  it('builds filename', () => {
    expect(csvFilename(new Date(2026, 7, 4))).toBe('Litter-Log-2026-08-04.csv')
  })
})
