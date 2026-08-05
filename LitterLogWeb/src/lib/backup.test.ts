import { describe, expect, it } from 'vitest'
import {
  createBackup,
  mergeBackupAnimals,
  mergeBackupEvents,
  parseBackup,
} from './backup'
import { createSeedAnimals } from './animals'
import { DEFAULT_SETTINGS, type BathroomEvent } from '../models/types'

const animals = createSeedAnimals()
const cleo = animals.find((animal) => animal.name === 'Cleo')!
const bower = animals.find((animal) => animal.name === 'Bower')!

const sample: BathroomEvent = {
  id: 'a',
  animalId: cleo.id,
  type: 'pee',
  timestamp: '2026-08-04T10:00:00.000Z',
  createdAt: '2026-08-04T10:00:00.000Z',
  note: null,
  source: 'web-app',
  schemaVersion: 2,
}

describe('backup', () => {
  it('generates and parses a multi-animal backup', () => {
    const backup = createBackup(
      [sample],
      { ...DEFAULT_SETTINGS, selectedAnimalId: cleo.id },
      animals,
    )
    const parsed = parseBackup(backup)
    expect(parsed.events).toHaveLength(1)
    expect(parsed.animals).toHaveLength(2)
    expect(parsed.schemaVersion).toBe(2)
    expect(parsed.events[0].animalId).toBe(cleo.id)
  })

  it('imports previous single-animal schema backups', () => {
    const legacy = {
      format: 'litter-log-backup',
      schemaVersion: 1,
      createdAt: '2026-08-04T10:00:00.000Z',
      events: [
        {
          id: 'legacy',
          type: 'poo',
          timestamp: '2026-08-04T11:00:00.000Z',
          createdAt: '2026-08-04T11:00:00.000Z',
          note: null,
          source: 'web-app',
          schemaVersion: 1,
        },
      ],
      settings: {
        ...DEFAULT_SETTINGS,
        catName: 'Mochi',
        schemaVersion: 1,
      },
    }
    const parsed = parseBackup(legacy)
    expect(parsed.animals.some((animal) => animal.name === 'Mochi')).toBe(true)
    expect(parsed.events[0].animalId).toBeTruthy()
    const mochi = parsed.animals.find((animal) => animal.name === 'Mochi')!
    expect(parsed.events[0].animalId).toBe(mochi.id)
  })

  it('rejects invalid backups', () => {
    expect(() => parseBackup({ hello: 'world' })).toThrow(
      /not a Litter Log backup/,
    )
    expect(() =>
      parseBackup({
        format: 'litter-log-backup',
        schemaVersion: 999,
        createdAt: 'x',
        events: [],
        animals: [],
        settings: DEFAULT_SETTINGS,
      }),
    ).toThrow(/unsupported/)
  })

  it('merges by id and skips duplicates', () => {
    const incoming: BathroomEvent = {
      ...sample,
      id: 'b',
      animalId: bower.id,
      type: 'poo',
    }
    const result = mergeBackupEvents([sample], [sample, incoming])
    expect(result.imported).toBe(1)
    expect(result.skippedDuplicates).toBe(1)
    expect(result.merged).toHaveLength(2)
  })

  it('merges animals without duplicating ids', () => {
    const third = {
      ...cleo,
      id: 'animal-third',
      name: 'Mochi',
    }
    const result = mergeBackupAnimals(animals, [cleo, third])
    expect(result.imported).toBe(1)
    expect(result.skippedDuplicates).toBe(1)
    expect(result.merged).toHaveLength(3)
  })
})
