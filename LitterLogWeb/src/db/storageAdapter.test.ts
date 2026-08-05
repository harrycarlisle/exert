import { beforeEach, describe, expect, it } from 'vitest'
import { createBackup } from '../lib/backup'
import type { BathroomEvent } from '../models/types'
import { deleteDatabaseForTests, setIndexedDBFactory } from './database'
import {
  clearLocalStorageBackendForTests,
  LS_AUTHORITY_KEY,
  LS_DOCUMENT_KEY,
  localStorageHasData,
  readAuthorityMarker,
} from './localStorageBackend'
import {
  fetchAnimals,
  fetchEvents,
  getActiveBackend,
  getStorageAdapterDiagnostics,
  initializeStorage,
  putAnimal,
  putEvent,
  recoverStorage,
  resetAdapterForTests,
  saveSettings,
} from './storageAdapter'

function makeEvent(
  type: BathroomEvent['type'],
  animalId: string,
  timestamp: string,
  id = `evt_${Math.random().toString(16).slice(2)}`,
): BathroomEvent {
  return {
    id,
    animalId,
    type,
    timestamp,
    createdAt: timestamp,
    note: 'exact note',
    source: 'web-app',
    schemaVersion: 2,
  }
}

describe('storage adapter and localStorage fallback', () => {
  beforeEach(async () => {
    resetAdapterForTests()
    clearLocalStorageBackendForTests()
    setIndexedDBFactory(null)
    await deleteDatabaseForTests()
  })

  it('uses IndexedDB when it opens normally', async () => {
    const backend = await initializeStorage()
    expect(backend).toBe('indexeddb')
    expect(getActiveBackend()).toBe('indexeddb')
    const animals = await fetchAnimals()
    expect(animals.map((a) => a.name).sort()).toEqual(['Bower', 'Cleo'])
  })

  it('falls back to localStorage when IndexedDB fails and marks it authoritative', async () => {
    setIndexedDBFactory({
      open() {
        throw new DOMException('idb down', 'UnknownError')
      },
    } as unknown as IDBFactory)

    const backend = await initializeStorage()
    expect(backend).toBe('localstorage')
    expect(readAuthorityMarker()).toBe('localstorage')

    const animals = await fetchAnimals()
    expect(animals.map((a) => a.name).sort()).toEqual(['Bower', 'Cleo'])
    expect(localStorageHasData()).toBe(true)

    const diag = getStorageAdapterDiagnostics()
    expect(diag.backend).toBe('localstorage')
    expect(diag.lastErrorName).toBe('UnknownError')
    expect(diag.lastErrorMessage).toMatch(/UnknownError/)
  })

  it('does not duplicate seed animals and can add a third animal on fallback', async () => {
    setIndexedDBFactory({
      open() {
        throw new DOMException('idb down', 'UnknownError')
      },
    } as unknown as IDBFactory)

    await initializeStorage()
    const first = await fetchAnimals()
    const again = await fetchAnimals()
    expect(again).toHaveLength(first.length)

    const cleo = first.find((animal) => animal.name === 'Cleo')!
    await putAnimal({
      id: 'animal_mochi',
      name: 'Mochi',
      color: null,
      createdAt: '2026-08-05T12:00:00.000Z',
      archived: false,
      displayOrder: 2,
      isSystem: false,
      schemaVersion: 1,
    })
    await saveSettings({
      selectedAnimalId: 'animal_mochi',
      vetPhoneNumber: '',
      hapticsEnabled: true,
      appearance: 'system',
      lastSafetyWarningAt: null,
      lastBackupAt: null,
      backupReminderDismissed: false,
      installPromptDismissed: false,
      schemaVersion: 2,
    })

    const animals = await fetchAnimals()
    expect(animals.map((a) => a.name).sort()).toEqual([
      'Bower',
      'Cleo',
      'Mochi',
    ])
    expect(animals.filter((a) => a.name === 'Cleo')).toHaveLength(1)

    const stamp = '2026-08-05T15:30:00.000Z'
    await putEvent(makeEvent('pee', cleo.id, stamp, 'evt_pee'))
    await putEvent(makeEvent('poo', cleo.id, stamp, 'evt_poo'))
    await putEvent(makeEvent('triedToPee', cleo.id, stamp, 'evt_ttp'))

    const events = await fetchEvents()
    expect(events).toHaveLength(3)
    expect(events.every((event) => event.timestamp === stamp)).toBe(true)
    expect(events.every((event) => event.note === 'exact note')).toBe(true)

    const { lsFetchSettings } = await import('./localStorageBackend')
    const backup = createBackup(events, await lsFetchSettings(), animals)
    expect(backup.events).toHaveLength(3)
    expect(backup.animals.map((a) => a.name)).toContain('Mochi')
  })

  it('stays on localStorage once authoritative even if IndexedDB becomes available', async () => {
    setIndexedDBFactory({
      open() {
        throw new DOMException('idb down', 'UnknownError')
      },
    } as unknown as IDBFactory)
    await initializeStorage()
    const animals = await fetchAnimals()
    const cleo = animals.find((animal) => animal.name === 'Cleo')!
    await putEvent(
      makeEvent('pee', cleo.id, '2026-08-05T10:00:00.000Z', 'sticky-event'),
    )

    resetAdapterForTests()
    setIndexedDBFactory(null)
    const backend = await initializeStorage()
    expect(backend).toBe('localstorage')
    expect(readAuthorityMarker()).toBe('localstorage')

    const events = await fetchEvents()
    expect(events.map((event) => event.id)).toContain('sticky-event')

    const diag = getStorageAdapterDiagnostics()
    expect(diag.backend).toBe('localstorage')
    // Diagnostics may report other-backend presence without exposing contents.
    expect(
      diag.otherBackendHasData === true ||
        diag.otherBackendHasData === false ||
        diag.otherBackendHasData === null,
    ).toBe(true)
  })

  it('rejects malformed fallback documents safely', async () => {
    localStorage.setItem(LS_DOCUMENT_KEY, '{not-json')
    localStorage.setItem(LS_AUTHORITY_KEY, 'localstorage')
    setIndexedDBFactory({
      open() {
        throw new DOMException('idb down', 'UnknownError')
      },
    } as unknown as IDBFactory)

    await expect(initializeStorage()).rejects.toMatchObject({
      name: 'StorageError',
      technicalMessage: expect.stringMatching(/Malformed|JSON/i),
    })
  })

  it('reports quota failures safely on fallback writes', async () => {
    setIndexedDBFactory({
      open() {
        throw new DOMException('idb down', 'UnknownError')
      },
    } as unknown as IDBFactory)
    await initializeStorage()
    const animals = await fetchAnimals()
    const cleo = animals.find((animal) => animal.name === 'Cleo')!

    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === LS_DOCUMENT_KEY) {
        const error = new DOMException('quota', 'QuotaExceededError')
        throw error
      }
      return originalSetItem.call(this, key, value)
    }

    try {
      await expect(
        putEvent(
          makeEvent('pee', cleo.id, '2026-08-05T11:00:00.000Z', 'quota-event'),
        ),
      ).rejects.toMatchObject({ errorName: 'QuotaExceededError' })
    } finally {
      Storage.prototype.setItem = originalSetItem
    }
  })

  it('recoverStorage creates a genuinely fresh backend selection', async () => {
    setIndexedDBFactory({
      open() {
        throw new DOMException('idb down', 'UnknownError')
      },
    } as unknown as IDBFactory)
    expect(await initializeStorage()).toBe('localstorage')

    resetAdapterForTests()
    clearLocalStorageBackendForTests()
    setIndexedDBFactory(null)
    expect(await recoverStorage()).toBe('indexeddb')
  })
})
