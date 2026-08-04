import {
  CURRENT_EVENT_SCHEMA,
  CURRENT_SETTINGS_SCHEMA,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BathroomEvent,
} from '../models/types'

const DB_NAME = 'litter-log'
const DB_VERSION = 1
const EVENTS_STORE = 'events'
const SETTINGS_STORE = 'settings'
const SETTINGS_KEY = 'app'

export class StorageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageError'
  }
}

type IDBFactoryLike = IDBFactory

let dbPromise: Promise<IDBDatabase> | null = null
let factoryOverride: IDBFactoryLike | null = null

/** Test-only: use a fake/isolated IndexedDB factory. */
export function setIndexedDBFactory(factory: IDBFactoryLike | null): void {
  factoryOverride = factory
  dbPromise = null
}

function getFactory(): IDBFactoryLike {
  const factory = factoryOverride ?? globalThis.indexedDB
  if (!factory) {
    throw new StorageError('IndexedDB is not available in this browser.')
  }
  return factory
}

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    try {
      request = getFactory().open(DB_NAME, DB_VERSION)
    } catch (error) {
      reject(
        new StorageError(
          error instanceof Error
            ? error.message
            : 'Could not open local storage.',
        ),
      )
      return
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const store = db.createObjectStore(EVENTS_STORE, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('type', 'type', { unique: false })
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      }
      // Future migrations: inspect request.oldVersion and migrate without deleting events.
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        new StorageError(request.error?.message ?? 'Could not open database.'),
      )
  })
  return dbPromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        new StorageError(request.error?.message ?? 'Storage request failed.'),
      )
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () =>
      reject(
        new StorageError(tx.error?.message ?? 'Storage transaction failed.'),
      )
    tx.onabort = () =>
      reject(
        new StorageError(tx.error?.message ?? 'Storage transaction aborted.'),
      )
  })
}

function normalizeEvent(raw: BathroomEvent): BathroomEvent {
  return {
    id: raw.id,
    type: raw.type,
    timestamp: raw.timestamp,
    createdAt: raw.createdAt,
    note: raw.note ?? null,
    source: 'web-app',
    schemaVersion: raw.schemaVersion || CURRENT_EVENT_SCHEMA,
  }
}

export async function fetchEvents(): Promise<BathroomEvent[]> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(EVENTS_STORE, 'readonly')
    const store = tx.objectStore(EVENTS_STORE)
    const rows = await requestToPromise(store.getAll())
    await txDone(tx)
    return (rows as BathroomEvent[])
      .map(normalizeEvent)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
  } catch (error) {
    if (error instanceof StorageError) throw error
    throw new StorageError('Could not read litter records.')
  }
}

export async function putEvent(event: BathroomEvent): Promise<BathroomEvent> {
  const normalized = normalizeEvent(event)
  try {
    const db = await openDatabase()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    tx.objectStore(EVENTS_STORE).put(normalized)
    await txDone(tx)
    return normalized
  } catch (error) {
    if (error instanceof StorageError) throw error
    throw new StorageError('Could not save that entry.')
  }
}

export async function putManyEvents(events: BathroomEvent[]): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    const store = tx.objectStore(EVENTS_STORE)
    for (const event of events) {
      store.put(normalizeEvent(event))
    }
    await txDone(tx)
  } catch (error) {
    if (error instanceof StorageError) throw error
    throw new StorageError('Could not save litter records.')
  }
}

export async function deleteEvent(id: string): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    tx.objectStore(EVENTS_STORE).delete(id)
    await txDone(tx)
  } catch (error) {
    if (error instanceof StorageError) throw error
    throw new StorageError('Could not delete that entry.')
  }
}

export async function deleteAllEvents(): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    tx.objectStore(EVENTS_STORE).clear()
    await txDone(tx)
  } catch (error) {
    if (error instanceof StorageError) throw error
    throw new StorageError('Could not delete history.')
  }
}

export async function fetchSettings(): Promise<AppSettings> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(SETTINGS_STORE, 'readonly')
    const row = await requestToPromise(
      tx.objectStore(SETTINGS_STORE).get(SETTINGS_KEY),
    )
    await txDone(tx)
    if (!row) return { ...DEFAULT_SETTINGS }
    const { key: _key, ...settings } = row as AppSettings & { key: string }
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      schemaVersion: settings.schemaVersion || CURRENT_SETTINGS_SCHEMA,
    }
  } catch (error) {
    if (error instanceof StorageError) throw error
    throw new StorageError('Could not read settings.')
  }
}

export async function saveSettings(
  settings: AppSettings,
): Promise<AppSettings> {
  const next = {
    ...settings,
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
  }
  try {
    const db = await openDatabase()
    const tx = db.transaction(SETTINGS_STORE, 'readwrite')
    tx.objectStore(SETTINGS_STORE).put({ key: SETTINGS_KEY, ...next })
    await txDone(tx)
    return next
  } catch (error) {
    if (error instanceof StorageError) throw error
    throw new StorageError('Could not save settings.')
  }
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Closes and forgets the cached connection (tests / recovery). */
export async function resetDatabaseConnection(): Promise<void> {
  if (dbPromise) {
    try {
      const db = await dbPromise
      db.close()
    } catch {
      // ignore
    }
  }
  dbPromise = null
}

export async function deleteDatabaseForTests(): Promise<void> {
  await resetDatabaseConnection()
  await new Promise<void>((resolve, reject) => {
    const request = getFactory().deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(new StorageError('Could not delete test database.'))
    request.onblocked = () => resolve()
  })
}
