import { describe, expect, it } from 'vitest'
import { csvFilename, escapeCsvField, eventsToCsv } from './csv'
import { createSeedAnimals } from './animals'
import type { BathroomEvent } from '../models/types'

describe('csv', () => {
  it('escapes commas, quotes, and line breaks', () => {
    expect(escapeCsvField('plain')).toBe('plain')
    expect(escapeCsvField('hello, world')).toBe('"hello, world"')
    expect(escapeCsvField('she said "hi"')).toBe('"she said ""hi"""')
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"')
  })

  it('includes animal fields, sorts oldest to newest, and escapes notes', () => {
    const animals = createSeedAnimals()
    const cleo = animals.find((animal) => animal.name === 'Cleo')!
    const bower = animals.find((animal) => animal.name === 'Bower')!
    const events: BathroomEvent[] = [
      {
        id: '2',
        animalId: bower.id,
        type: 'poo',
        timestamp: '2026-08-04T18:00:00.000Z',
        createdAt: '2026-08-04T18:00:00.000Z',
        note: 'second, with comma',
        source: 'web-app',
        schemaVersion: 2,
      },
      {
        id: '1',
        animalId: cleo.id,
        type: 'pee',
        timestamp: '2026-08-04T10:00:00.000Z',
        createdAt: '2026-08-04T10:00:00.000Z',
        note: 'first',
        source: 'web-app',
        schemaVersion: 2,
      },
    ]
    const csv = eventsToCsv(events, animals)
    const lines = csv.trim().split('\n')
    expect(lines[0]).toContain('animal_id')
    expect(lines[0]).toContain('animal_name')
    expect(lines[1]).toContain(cleo.id)
    expect(lines[1]).toContain('Cleo')
    expect(lines[1]).toContain('Pee')
    expect(lines[2]).toContain('Bower')
    expect(lines[2]).toContain('Poo')
    expect(lines[2]).toContain('"second, with comma"')
    expect(lines[2]).toContain('Web App')
  })

  it('builds filename', () => {
    expect(csvFilename(new Date(2026, 7, 4))).toBe('Litter-Log-2026-08-04.csv')
  })
})
