import {
  createSeedAnimals,
  createUnassignedAnimal,
  findAnimalByName,
  isReliableLegacyCatName,
  nextActiveAnimalId,
  normalizeAnimalName,
  pickDefaultSelectedAnimalId,
} from '../lib/animals'
import { toISO } from '../lib/dates'
import {
  CURRENT_ANIMAL_SCHEMA,
  CURRENT_EVENT_SCHEMA,
  CURRENT_SETTINGS_SCHEMA,
  DEFAULT_SETTINGS,
  STORAGE_LOAD_ERROR,
  STORAGE_SAVE_ERROR,
  type Animal,
  type AppSettings,
  type BathroomEvent,
} from '../models/types'

const DB_NAME = 'litter-log'
const DB_VERSION = 2
const EVENTS_STORE = 'events'
const SETTINGS_STORE = 'settings'
const ANIMALS_STORE = 'animals'
const SETTINGS_KEY = 'app'

export class StorageError extends Error {
  readonly userMessage: string
  readonly technicalMessage: string

  constructor(userMessage: string, technicalMessage?: string) {
    super(userMessage)
    this.name = 'StorageError'
    this.userMessage = userMessage
    this.technicalMessage = technicalMessage ?? userMessage
  }
}

type IDBFactoryLike = IDBFactory

let dbPromise: Promise<IDBDatabase> | null = null
let cachedDb: IDBDatabase | null = null
let factoryOverride: IDBFactoryLike | null = null
let migrationPromise: Promise<void> | null = null
let lastTechnicalError: string | null = null

/** Test-only: use a fake/isolated IndexedDB factory. */
export function setIndexedDBFactory(factory: IDBFactoryLike | null): void {
  factoryOverride = factory
  void resetDatabaseConnection()
}

export function getLastTechnicalStorageError(): string | null {
  return lastTechnicalError
}

function rememberTechnicalError(error: unknown): void {
  if (error instanceof StorageError) {
    lastTechnicalError = error.technicalMessage
    return
  }
  if (error instanceof Error) {
    lastTechnicalError = error.message
    return
  }
  lastTechnicalError = String(error)
}

function getFactory(): IDBFactoryLike {
  const factory = factoryOverride ?? globalThis.indexedDB
  if (!factory) {
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      'IndexedDB is not available in this browser.',
    )
  }
  return factory
}

function wireDatabase(db: IDBDatabase): IDBDatabase {
  cachedDb = db
  db.onclose = () => {
    if (cachedDb === db) {
      cachedDb = null
      dbPromise = null
      migrationPromise = null
    }
  }
  db.onversionchange = () => {
    try {
      db.close()
    } catch {
      // ignore
    }
    if (cachedDb === db) {
      cachedDb = null
      dbPromise = null
      migrationPromise = null
    }
  }
  return db
}

function openDatabaseInternal(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    let settled = false

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      rememberTechnicalError(error)
      reject(
        error instanceof StorageError
          ? error
          : new StorageError(
              STORAGE_LOAD_ERROR,
              error instanceof Error
                ? error.message
                : 'Could not open local storage.',
            ),
      )
    }

    const succeed = (db: IDBDatabase) => {
      if (settled) return
      settled = true
      resolve(wireDatabase(db))
    }

    try {
      request = getFactory().open(DB_NAME, DB_VERSION)
    } catch (error) {
      fail(error)
      return
    }

    request.onupgradeneeded = (event) => {
      const db = request.result
      const oldVersion = event.oldVersion

      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        const store = db.createObjectStore(EVENTS_STORE, { keyPath: 'id' })
        store.createIndex('timestamp', 'timestamp', { unique: false })
        store.createIndex('type', 'type', { unique: false })
        store.createIndex('animalId', 'animalId', { unique: false })
      }

      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(ANIMALS_STORE)) {
          const animals = db.createObjectStore(ANIMALS_STORE, {
            keyPath: 'id',
          })
          animals.createIndex('name', 'name', { unique: false })
          animals.createIndex('archived', 'archived', { unique: false })
        }

        // Add animalId index when upgrading; only if the events store already existed.
        const tx = request.transaction
        if (tx && db.objectStoreNames.contains(EVENTS_STORE)) {
          const eventsStore = tx.objectStore(EVENTS_STORE)
          if (!eventsStore.indexNames.contains('animalId')) {
            eventsStore.createIndex('animalId', 'animalId', { unique: false })
          }
        }
      }
    }

    request.onsuccess = () => succeed(request.result)
    request.onerror = () =>
      fail(
        new StorageError(
          STORAGE_LOAD_ERROR,
          request.error?.message ?? 'Could not open database.',
        ),
      )
    request.onblocked = () => {
      // Another connection is blocking the upgrade. Wait briefly; onsuccess/onerror still fire.
      window.setTimeout(() => {
        if (!settled) {
          fail(
            new StorageError(
              STORAGE_LOAD_ERROR,
              'Database upgrade blocked by another open connection.',
            ),
          )
        }
      }, 4000)
    }
  })
}

async function openDatabase(): Promise<IDBDatabase> {
  if (cachedDb) return cachedDb
  if (!dbPromise) {
    dbPromise = openDatabaseInternal().catch((error) => {
      dbPromise = null
      cachedDb = null
      throw error
    })
  }
  const db = await dbPromise
  await ensureAnimalMigration(db)
  return db
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(
        new StorageError(
          STORAGE_SAVE_ERROR,
          request.error?.message ?? 'Storage request failed.',
        ),
      )
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () =>
      reject(
        new StorageError(
          STORAGE_SAVE_ERROR,
          tx.error?.message ?? 'Storage transaction failed.',
        ),
      )
    tx.onabort = () =>
      reject(
        new StorageError(
          STORAGE_SAVE_ERROR,
          tx.error?.message ?? 'Storage transaction aborted.',
        ),
      )
  })
}

function normalizeAnimal(raw: Animal): Animal {
  return {
    id: raw.id,
    name: normalizeAnimalName(raw.name),
    color: raw.color ?? null,
    createdAt: raw.createdAt,
    archived: Boolean(raw.archived),
    displayOrder: raw.displayOrder ?? null,
    isSystem: Boolean(raw.isSystem),
    schemaVersion: raw.schemaVersion || CURRENT_ANIMAL_SCHEMA,
  }
}

function normalizeEvent(raw: BathroomEvent): BathroomEvent {
  return {
    id: raw.id,
    animalId: raw.animalId,
    type: raw.type,
    timestamp: raw.timestamp,
    createdAt: raw.createdAt,
    note: raw.note ?? null,
    source: 'web-app',
    schemaVersion: raw.schemaVersion || CURRENT_EVENT_SCHEMA,
  }
}

function normalizeSettings(
  raw: Partial<AppSettings> & { catName?: string },
): AppSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    selectedAnimalId: raw.selectedAnimalId ?? null,
    vetPhoneNumber: raw.vetPhoneNumber ?? '',
    hapticsEnabled: raw.hapticsEnabled ?? true,
    appearance: raw.appearance ?? 'system',
    lastSafetyWarningAt: raw.lastSafetyWarningAt ?? null,
    lastBackupAt: raw.lastBackupAt ?? null,
    backupReminderDismissed: raw.backupReminderDismissed ?? false,
    installPromptDismissed: raw.installPromptDismissed ?? false,
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
    // Keep catName only in-memory for migration helpers; strip on save.
    catName: typeof raw.catName === 'string' ? raw.catName : undefined,
  }
}

async function readAllAnimals(db: IDBDatabase): Promise<Animal[]> {
  if (!db.objectStoreNames.contains(ANIMALS_STORE)) return []
  const tx = db.transaction(ANIMALS_STORE, 'readonly')
  const rows = await requestToPromise(tx.objectStore(ANIMALS_STORE).getAll())
  await txDone(tx)
  return (rows as Animal[]).map(normalizeAnimal)
}

async function readAllEventsRaw(db: IDBDatabase): Promise<BathroomEvent[]> {
  const tx = db.transaction(EVENTS_STORE, 'readonly')
  const rows = await requestToPromise(tx.objectStore(EVENTS_STORE).getAll())
  await txDone(tx)
  return rows as BathroomEvent[]
}

async function readSettingsRaw(
  db: IDBDatabase,
): Promise<Partial<AppSettings> & { catName?: string }> {
  const tx = db.transaction(SETTINGS_STORE, 'readonly')
  const row = await requestToPromise(
    tx.objectStore(SETTINGS_STORE).get(SETTINGS_KEY),
  )
  await txDone(tx)
  if (!row) return {}
  const { key: _key, ...settings } = row as AppSettings & {
    key: string
    catName?: string
  }
  return settings
}

/**
 * Idempotent data migration for multi-animal support.
 * Safe to interrupt and re-run; never deletes existing events.
 */
async function ensureAnimalMigration(db: IDBDatabase): Promise<void> {
  if (migrationPromise) {
    await migrationPromise
    return
  }

  migrationPromise = (async () => {
    if (!db.objectStoreNames.contains(ANIMALS_STORE)) {
      // Unexpected: upgrade should have created the store. Force reconnect on next open.
      throw new StorageError(
        STORAGE_LOAD_ERROR,
        'Animals store missing after database open.',
      )
    }

    let animals = await readAllAnimals(db)
    const settingsRaw = await readSettingsRaw(db)
    const eventsRaw = await readAllEventsRaw(db)
    const now = toISO()
    let dirtyAnimals = false
    let dirtyEvents = false
    let dirtySettings = false

    if (animals.length === 0) {
      animals = createSeedAnimals(now)
      dirtyAnimals = true

      const legacyName = settingsRaw.catName
      if (isReliableLegacyCatName(legacyName)) {
        const match = findAnimalByName(animals, legacyName!)
        if (!match) {
          animals.push(
            normalizeAnimal({
              id: `animal_legacy_${Date.now().toString(16)}`,
              name: normalizeAnimalName(legacyName!),
              color: null,
              createdAt: now,
              archived: false,
              displayOrder: animals.length,
              isSystem: false,
              schemaVersion: CURRENT_ANIMAL_SCHEMA,
            }),
          )
        }
      } else if (eventsRaw.some((event) => !event.animalId)) {
        animals.push(createUnassignedAnimal(now))
      }
    } else {
      // Ensure seed names exist for fresh installs that somehow only have custom animals.
      // Do not force-add Cleo/Bower if the user already has animals from an earlier migration.
    }

    const resolveLegacyTargetId = (): string => {
      const legacyName = settingsRaw.catName
      if (isReliableLegacyCatName(legacyName)) {
        const match = findAnimalByName(animals, legacyName!)
        if (match) return match.id
      }
      let unassigned = animals.find((animal) => animal.isSystem)
      if (!unassigned) {
        unassigned = createUnassignedAnimal(now)
        animals = [...animals, unassigned]
        dirtyAnimals = true
      }
      return unassigned.id
    }

    const eventsToUpdate: BathroomEvent[] = []
    for (const event of eventsRaw) {
      if (event.animalId) continue
      const animalId = resolveLegacyTargetId()
      eventsToUpdate.push(
        normalizeEvent({
          ...event,
          animalId,
          schemaVersion: CURRENT_EVENT_SCHEMA,
        }),
      )
      dirtyEvents = true
    }

    const selectedAnimalId = nextActiveAnimalId(
      animals,
      settingsRaw.selectedAnimalId ?? null,
    )
    const nextSettings = normalizeSettings({
      ...DEFAULT_SETTINGS,
      ...settingsRaw,
      selectedAnimalId,
      schemaVersion: CURRENT_SETTINGS_SCHEMA,
    })
    delete nextSettings.catName

    if (
      settingsRaw.selectedAnimalId !== nextSettings.selectedAnimalId ||
      settingsRaw.schemaVersion !== CURRENT_SETTINGS_SCHEMA ||
      typeof settingsRaw.catName === 'string'
    ) {
      dirtySettings = true
    }

    if (dirtyAnimals || dirtyEvents || dirtySettings) {
      const storeNames = [
        ANIMALS_STORE,
        ...(dirtyEvents ? [EVENTS_STORE] : []),
        ...(dirtySettings ? [SETTINGS_STORE] : []),
      ]
      const tx = db.transaction(storeNames, 'readwrite')
      if (dirtyAnimals) {
        const store = tx.objectStore(ANIMALS_STORE)
        for (const animal of animals) {
          store.put(normalizeAnimal(animal))
        }
      }
      if (dirtyEvents) {
        const store = tx.objectStore(EVENTS_STORE)
        for (const event of eventsToUpdate) {
          store.put(event)
        }
      }
      if (dirtySettings) {
        tx.objectStore(SETTINGS_STORE).put({
          key: SETTINGS_KEY,
          ...nextSettings,
        })
      }
      await txDone(tx)
    }
  })()
    .catch((error) => {
      migrationPromise = null
      rememberTechnicalError(error)
      throw error instanceof StorageError
        ? error
        : new StorageError(STORAGE_LOAD_ERROR, String(error))
    })
    .then(() => {
      // Keep migrationPromise resolved so subsequent opens skip re-entry work
      // unless the connection is reset.
    })

  await migrationPromise
}

export async function fetchAnimals(): Promise<Animal[]> {
  try {
    const db = await openDatabase()
    const animals = await readAllAnimals(db)
    return animals.sort((a, b) => {
      const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER
      const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(STORAGE_LOAD_ERROR, 'Could not read animals.')
  }
}

export async function putAnimal(animal: Animal): Promise<Animal> {
  const normalized = normalizeAnimal(animal)
  try {
    const db = await openDatabase()
    const tx = db.transaction(ANIMALS_STORE, 'readwrite')
    tx.objectStore(ANIMALS_STORE).put(normalized)
    await txDone(tx)
    return normalized
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(STORAGE_SAVE_ERROR, 'Could not save animal.')
  }
}

export async function putManyAnimals(animals: Animal[]): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(ANIMALS_STORE, 'readwrite')
    const store = tx.objectStore(ANIMALS_STORE)
    for (const animal of animals) {
      store.put(normalizeAnimal(animal))
    }
    await txDone(tx)
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(STORAGE_SAVE_ERROR, 'Could not save animals.')
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
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(STORAGE_LOAD_ERROR, 'Could not read litter records.')
  }
}

export async function putEvent(event: BathroomEvent): Promise<BathroomEvent> {
  if (!event.animalId) {
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      'Cannot save an event without animalId.',
    )
  }
  const normalized = normalizeEvent(event)
  try {
    const db = await openDatabase()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    tx.objectStore(EVENTS_STORE).put(normalized)
    await txDone(tx)
    return normalized
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(STORAGE_SAVE_ERROR, 'Could not save that entry.')
  }
}

export async function putManyEvents(events: BathroomEvent[]): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    const store = tx.objectStore(EVENTS_STORE)
    for (const event of events) {
      if (!event.animalId) {
        throw new StorageError(
          STORAGE_SAVE_ERROR,
          'Cannot save an event without animalId.',
        )
      }
      store.put(normalizeEvent(event))
    }
    await txDone(tx)
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(STORAGE_SAVE_ERROR, 'Could not save litter records.')
  }
}

export async function deleteEvent(id: string): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    tx.objectStore(EVENTS_STORE).delete(id)
    await txDone(tx)
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(STORAGE_SAVE_ERROR, 'Could not delete that entry.')
  }
}

export async function deleteAllEvents(): Promise<void> {
  try {
    const db = await openDatabase()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    tx.objectStore(EVENTS_STORE).clear()
    await txDone(tx)
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(STORAGE_SAVE_ERROR, 'Could not delete history.')
  }
}

export async function fetchSettings(): Promise<AppSettings> {
  try {
    const db = await openDatabase()
    const raw = await readSettingsRaw(db)
    const animals = await readAllAnimals(db)
    const settings = normalizeSettings(raw)
    settings.selectedAnimalId = nextActiveAnimalId(
      animals,
      settings.selectedAnimalId,
    )
    delete settings.catName
    return settings
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(STORAGE_LOAD_ERROR, 'Could not read settings.')
  }
}

export async function saveSettings(
  settings: AppSettings,
): Promise<AppSettings> {
  const next = normalizeSettings(settings)
  delete next.catName
  try {
    const db = await openDatabase()
    const tx = db.transaction(SETTINGS_STORE, 'readwrite')
    tx.objectStore(SETTINGS_STORE).put({ key: SETTINGS_KEY, ...next })
    await txDone(tx)
    return next
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(STORAGE_SAVE_ERROR, 'Could not save settings.')
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
  if (cachedDb) {
    try {
      cachedDb.close()
    } catch {
      // ignore
    }
  } else if (dbPromise) {
    try {
      const db = await dbPromise
      db.close()
    } catch {
      // ignore rejected open
    }
  }
  cachedDb = null
  dbPromise = null
  migrationPromise = null
}

export async function recoverStorage(): Promise<void> {
  await resetDatabaseConnection()
  lastTechnicalError = null
  await openDatabase()
}

export async function deleteDatabaseForTests(): Promise<void> {
  await resetDatabaseConnection()
  await new Promise<void>((resolve, reject) => {
    const request = getFactory().deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(
        new StorageError(STORAGE_LOAD_ERROR, 'Could not delete test database.'),
      )
    request.onblocked = () => resolve()
  })
}

/** Exported for tests that need to assert migration defaults. */
export function defaultSelectedAnimalIdFor(animals: Animal[]): string | null {
  return pickDefaultSelectedAnimalId(animals)
}
