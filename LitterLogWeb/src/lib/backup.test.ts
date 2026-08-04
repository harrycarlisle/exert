import { describe, expect, it } from 'vitest'
import { createBackup, mergeBackupEvents, parseBackup } from './backup'
import { DEFAULT_SETTINGS, type BathroomEvent } from '../models/types'

const sample: BathroomEvent = {
  id: 'a',
  type: 'pee',
  timestamp: '2026-08-04T10:00:00.000Z',
  createdAt: '2026-08-04T10:00:00.000Z',
  note: null,
  source: 'web-app',
  schemaVersion: 1,
}

describe('backup', () => {
  it('generates and parses a valid backup', () => {
    const backup = createBackup([sample], DEFAULT_SETTINGS)
    const parsed = parseBackup(backup)
    expect(parsed.events).toHaveLength(1)
    expect(parsed.format).toBe('litter-log-backup')
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
        settings: DEFAULT_SETTINGS,
      }),
    ).toThrow(/unsupported/)
  })

  it('merges by id and skips duplicates', () => {
    const incoming: BathroomEvent = {
      ...sample,
      id: 'b',
      type: 'poo',
    }
    const result = mergeBackupEvents([sample], [sample, incoming])
    expect(result.imported).toBe(1)
    expect(result.skippedDuplicates).toBe(1)
    expect(result.merged).toHaveLength(2)
  })
})
