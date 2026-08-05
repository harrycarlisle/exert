import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteAllEvents,
  deleteDatabaseForTests,
  deleteEvent,
  fetchAnimals,
  fetchEvents,
  fetchSettings,
  putEvent,
  putManyEvents,
  resetDatabaseConnection,
  saveSettings,
} from './database'
import { DEFAULT_SETTINGS, type BathroomEvent } from '../models/types'

function makeEvent(
  type: BathroomEvent['type'],
  timestamp: string,
  animalId: string,
  id: string = `evt_${Math.random().toString(16).slice(2)}`,
): BathroomEvent {
  return {
    id,
    animalId,
    type,
    timestamp,
    createdAt: timestamp,
    note: null,
    source: 'web-app',
    schemaVersion: 2,
  }
}

async function seedLegacyDatabase(options: {
  catName?: string
  withEvent?: boolean
}): Promise<void> {
  await deleteDatabaseForTests()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('litter-log', 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('events')) {
        const store = db.createObjectStore('events', { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('type', 'type', { unique: false })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    }
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction(['events', 'settings'], 'readwrite')
      if (options.withEvent) {
        tx.objectStore('events').put({
          id: 'legacy-event',
          type: 'pee',
          timestamp: '2026-08-04T10:00:00.000Z',
          createdAt: '2026-08-04T10:00:00.000Z',
          note: 'keep me',
          source: 'web-app',
          schemaVersion: 1,
        })
      }
      tx.objectStore('settings').put({
        key: 'app',
        catName: options.catName ?? '',
        vetPhoneNumber: '555-0100',
        hapticsEnabled: true,
        appearance: 'light',
        lastSafetyWarningAt: null,
        lastBackupAt: null,
        backupReminderDismissed: false,
        installPromptDismissed: false,
        schemaVersion: 1,
      })
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    }
  })
  await resetDatabaseConnection()
}

describe('IndexedDB store', () => {
  beforeEach(async () => {
    await deleteDatabaseForTests()
  })

  it('seeds Cleo and Bower on first open', async () => {
    const animals = await fetchAnimals()
    expect(animals.map((animal) => animal.name).sort()).toEqual([
      'Bower',
      'Cleo',
    ])
    const settings = await fetchSettings()
    const cleo = animals.find((animal) => animal.name === 'Cleo')
    expect(settings.selectedAnimalId).toBe(cleo?.id)
  })

  it('creates each event type and retrieves them', async () => {
    const animals = await fetchAnimals()
    const cleo = animals.find((animal) => animal.name === 'Cleo')!
    await putEvent(makeEvent('pee', '2026-08-04T10:00:00.000Z', cleo.id))
    await putEvent(makeEvent('poo', '2026-08-04T11:00:00.000Z', cleo.id))
    await putEvent(makeEvent('triedToPee', '2026-08-04T12:00:00.000Z', cleo.id))
    const events = await fetchEvents()
    expect(events).toHaveLength(3)
    expect(new Set(events.map((e) => e.type))).toEqual(
      new Set(['pee', 'poo', 'triedToPee']),
    )
    expect(events.every((event) => event.animalId === cleo.id)).toBe(true)
  })

  it('preserves multiple rapid inserts', async () => {
    const animals = await fetchAnimals()
    const animalId = animals[0].id
    const batch = Array.from({ length: 20 }, (_, i) =>
      makeEvent(
        i % 2 === 0 ? 'pee' : 'poo',
        new Date(Date.UTC(2026, 7, 4, 0, i)).toISOString(),
        animalId,
      ),
    )
    await putManyEvents(batch)
    expect(await fetchEvents()).toHaveLength(20)
  })

  it('edits and deletes events', async () => {
    const animals = await fetchAnimals()
    const animalId = animals[0].id
    const event = makeEvent(
      'pee',
      '2026-08-04T10:00:00.000Z',
      animalId,
      'edit-me',
    )
    await putEvent(event)
    await putEvent({ ...event, type: 'triedToPee', note: 'straining' })
    let events = await fetchEvents()
    expect(events[0].type).toBe('triedToPee')
    expect(events[0].note).toBe('straining')
    await deleteEvent('edit-me')
    events = await fetchEvents()
    expect(events).toHaveLength(0)
  })

  it('persists settings and selected animal', async () => {
    const animals = await fetchAnimals()
    const bower = animals.find((animal) => animal.name === 'Bower')!
    await saveSettings({
      ...DEFAULT_SETTINGS,
      selectedAnimalId: bower.id,
      hapticsEnabled: false,
      appearance: 'dark',
    })
    const settings = await fetchSettings()
    expect(settings.selectedAnimalId).toBe(bower.id)
    expect(settings.hapticsEnabled).toBe(false)
    expect(settings.appearance).toBe('dark')
  })

  it('handles empty database safely', async () => {
    expect(await fetchEvents()).toEqual([])
    const settings = await fetchSettings()
    expect(settings.vetPhoneNumber).toBe('')
    await deleteAllEvents()
    expect(await fetchEvents()).toEqual([])
  })

  it('migrates legacy single-animal data for a matching name without loss', async () => {
    await seedLegacyDatabase({ catName: 'Cleo', withEvent: true })
    const animals = await fetchAnimals()
    const events = await fetchEvents()
    const settings = await fetchSettings()
    expect(animals.some((animal) => animal.name === 'Cleo')).toBe(true)
    expect(animals.some((animal) => animal.name === 'Bower')).toBe(true)
    expect(events).toHaveLength(1)
    expect(events[0].note).toBe('keep me')
    expect(events[0].id).toBe('legacy-event')
    const cleo = animals.find((animal) => animal.name === 'Cleo')!
    expect(events[0].animalId).toBe(cleo.id)
    expect(settings.vetPhoneNumber).toBe('555-0100')
    expect(settings.selectedAnimalId).toBe(cleo.id)
  })

  it('preserves a differently named legacy animal profile', async () => {
    await seedLegacyDatabase({ catName: 'Mochi', withEvent: true })
    const animals = await fetchAnimals()
    const events = await fetchEvents()
    expect(animals.map((animal) => animal.name).sort()).toEqual([
      'Bower',
      'Cleo',
      'Mochi',
    ])
    const mochi = animals.find((animal) => animal.name === 'Mochi')!
    expect(events[0].animalId).toBe(mochi.id)
  })

  it('marks ambiguous legacy records as Unassigned', async () => {
    await seedLegacyDatabase({ catName: '', withEvent: true })
    const animals = await fetchAnimals()
    const events = await fetchEvents()
    const unassigned = animals.find((animal) => animal.name === 'Unassigned')
    expect(unassigned).toBeTruthy()
    expect(unassigned?.archived).toBe(true)
    expect(events[0].animalId).toBe(unassigned!.id)
  })

  it('is safe to re-run migration', async () => {
    await seedLegacyDatabase({ catName: 'Cleo', withEvent: true })
    await fetchEvents()
    await resetDatabaseConnection()
    const animals = await fetchAnimals()
    const events = await fetchEvents()
    expect(animals.filter((animal) => animal.name === 'Cleo')).toHaveLength(1)
    expect(events).toHaveLength(1)
  })
})
