import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DB_NAME,
  DB_VERSION,
  deleteDatabaseForTests,
  fetchAnimals,
  fetchEvents,
  formatDomException,
  getCachedOpenPromiseForTests,
  getLastTechnicalStorageError,
  putEvent,
  recoverStorage,
  resetDatabaseConnection,
  StorageError,
} from './database'

async function seedIncompleteV2(): Promise<void> {
  await deleteDatabaseForTests()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2)
    request.onupgradeneeded = () => {
      const db = request.result
      // Intentionally incomplete: events + settings only, no animals store.
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
      tx.objectStore('events').put({
        id: 'keep-me',
        type: 'pee',
        timestamp: '2026-08-04T10:00:00.000Z',
        createdAt: '2026-08-04T10:00:00.000Z',
        note: 'survived repair',
        source: 'web-app',
        schemaVersion: 1,
      })
      tx.objectStore('settings').put({
        key: 'app',
        catName: 'Cleo',
        vetPhoneNumber: '',
        hapticsEnabled: true,
        appearance: 'system',
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

describe('storage recovery', () => {
  beforeEach(async () => {
    await deleteDatabaseForTests()
  })

  it('formats DOM exception name and message', () => {
    const error = new DOMException('The operation was aborted.', 'AbortError')
    expect(formatDomException(error)).toContain('AbortError')
    expect(formatDomException(error)).toContain('aborted')
  })

  it('does not permanently cache a rejected open promise', async () => {
    const openSpy = vi.spyOn(indexedDB, 'open')
    openSpy.mockImplementationOnce(() => {
      const request = {
        result: undefined,
        error: new DOMException('fail once', 'UnknownError'),
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null,
      } as unknown as IDBOpenDBRequest
      queueMicrotask(() => {
        request.onerror?.(new Event('error'))
      })
      return request
    })

    await expect(fetchAnimals()).rejects.toBeInstanceOf(StorageError)
    expect(getCachedOpenPromiseForTests()).toBeNull()
    expect(getLastTechnicalStorageError()).toMatch(/UnknownError|fail once/)

    openSpy.mockRestore()
    const animals = await fetchAnimals()
    expect(animals.map((animal) => animal.name).sort()).toEqual([
      'Bower',
      'Cleo',
    ])
  })

  it('repairs an incomplete v2 database without losing events', async () => {
    await seedIncompleteV2()
    const animals = await fetchAnimals()
    const events = await fetchEvents()
    expect(animals.some((animal) => animal.name === 'Cleo')).toBe(true)
    expect(animals.some((animal) => animal.name === 'Bower')).toBe(true)
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('keep-me')
    expect(events[0].note).toBe('survived repair')
    expect(events[0].animalId).toBeTruthy()
  })

  it('does not recreate existing stores during migration to current version', async () => {
    await fetchAnimals()
    await resetDatabaseConnection()
    const createSpy = vi.spyOn(IDBDatabase.prototype, 'createObjectStore')
    await fetchAnimals()
    expect(createSpy).not.toHaveBeenCalled()
    createSpy.mockRestore()
  })

  it('recoverStorage performs a fresh open and reloads data', async () => {
    const animals = await fetchAnimals()
    const cleo = animals.find((animal) => animal.name === 'Cleo')!
    await putEvent({
      id: 'evt-1',
      animalId: cleo.id,
      type: 'pee',
      timestamp: '2026-08-04T12:00:00.000Z',
      createdAt: '2026-08-04T12:00:00.000Z',
      note: null,
      source: 'web-app',
      schemaVersion: 2,
    })
    await recoverStorage()
    const events = await fetchEvents()
    expect(events).toHaveLength(1)
    expect(events[0].id).toBe('evt-1')
  })

  it('seeds Cleo and Bower only on a new installation', async () => {
    const first = await fetchAnimals()
    expect(first).toHaveLength(2)
    await resetDatabaseConnection()
    const second = await fetchAnimals()
    expect(second).toHaveLength(2)
    expect(second.map((animal) => animal.id).sort()).toEqual(
      first.map((animal) => animal.id).sort(),
    )
  })

  it('exposes a DB version at least as high as the repair target', async () => {
    await seedIncompleteV2()
    await fetchAnimals()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME)
      request.onsuccess = () => {
        expect(request.result.version).toBeGreaterThanOrEqual(DB_VERSION)
        expect(request.result.objectStoreNames.contains('animals')).toBe(true)
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  })
})
