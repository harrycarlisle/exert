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

export const DB_NAME = 'litter-log'
/** v3 repairs incomplete v2 schemas (missing animals store / indexes). */
export const DB_VERSION = 3
const EVENTS_STORE = 'events'
const SETTINGS_STORE = 'settings'
const ANIMALS_STORE = 'animals'
const SETTINGS_KEY = 'app'

const BLOCKED_WAIT_MS = 2500
const BLOCKED_RETRY_LIMIT = 2

export class StorageError extends Error {
  readonly userMessage: string
  readonly technicalMessage: string
  readonly errorName: string | null

  constructor(
    userMessage: string,
    technicalMessage?: string,
    errorName: string | null = null,
  ) {
    super(userMessage)
    this.name = 'StorageError'
    this.userMessage = userMessage
    this.technicalMessage = technicalMessage ?? userMessage
    this.errorName = errorName
  }
}

type IDBFactoryLike = IDBFactory

let dbPromise: Promise<IDBDatabase> | null = null
let cachedDb: IDBDatabase | null = null
let factoryOverride: IDBFactoryLike | null = null
let migrationPromise: Promise<void> | null = null
let lastTechnicalError: string | null = null
let schemaReadyFor: IDBDatabase | null = null
/** Temporary bump used only to repair an incomplete schema at the current version. */
let repairTargetVersion: number | null = null

function targetDbVersion(): number {
  return repairTargetVersion ?? DB_VERSION
}

/** Test-only: use a fake/isolated IndexedDB factory. */
export function setIndexedDBFactory(factory: IDBFactoryLike | null): void {
  factoryOverride = factory
  void resetDatabaseConnection()
}

export function getLastTechnicalStorageError(): string | null {
  return lastTechnicalError
}

export function formatDomException(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) {
    const name = error.name || 'Error'
    const message = error.message?.trim() || '(no message)'
    const code =
      'code' in error && typeof (error as DOMException).code === 'number'
        ? ` code=${(error as DOMException).code}`
        : ''
    return `${name}: ${message}${code}`
  }
  return String(error)
}

function rememberTechnicalError(error: unknown): void {
  if (error instanceof StorageError) {
    lastTechnicalError = error.errorName
      ? `${error.errorName}: ${error.technicalMessage}`
      : error.technicalMessage
    return
  }
  lastTechnicalError = formatDomException(error)
}

function getFactory(): IDBFactoryLike {
  const factory = factoryOverride ?? globalThis.indexedDB
  if (!factory) {
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      'IndexedDB is not available in this browser.',
      'Unavailable',
    )
  }
  return factory
}

function hasCompleteSchema(db: IDBDatabase): boolean {
  if (!db.objectStoreNames.contains(EVENTS_STORE)) return false
  if (!db.objectStoreNames.contains(SETTINGS_STORE)) return false
  if (!db.objectStoreNames.contains(ANIMALS_STORE)) return false
  try {
    const tx = db.transaction([EVENTS_STORE, ANIMALS_STORE], 'readonly')
    const events = tx.objectStore(EVENTS_STORE)
    const animals = tx.objectStore(ANIMALS_STORE)
    return (
      events.indexNames.contains('timestamp') &&
      events.indexNames.contains('type') &&
      events.indexNames.contains('animalId') &&
      animals.indexNames.contains('name') &&
      animals.indexNames.contains('archived')
    )
  } catch {
    return false
  }
}

/**
 * Idempotent schema ensure — never recreate existing stores/indexes.
 * Safe for fresh installs, v1→v2, and incomplete v2 repairs (v3).
 */
export function ensureObjectStores(db: IDBDatabase, tx: IDBTransaction): void {
  if (!db.objectStoreNames.contains(EVENTS_STORE)) {
    const store = db.createObjectStore(EVENTS_STORE, { keyPath: 'id' })
    store.createIndex('timestamp', 'timestamp', { unique: false })
    store.createIndex('type', 'type', { unique: false })
    store.createIndex('animalId', 'animalId', { unique: false })
  } else if (tx.objectStoreNames.contains(EVENTS_STORE)) {
    const eventsStore = tx.objectStore(EVENTS_STORE)
    if (!eventsStore.indexNames.contains('timestamp')) {
      eventsStore.createIndex('timestamp', 'timestamp', { unique: false })
    }
    if (!eventsStore.indexNames.contains('type')) {
      eventsStore.createIndex('type', 'type', { unique: false })
    }
    if (!eventsStore.indexNames.contains('animalId')) {
      eventsStore.createIndex('animalId', 'animalId', { unique: false })
    }
  }

  if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
    db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' })
  }

  if (!db.objectStoreNames.contains(ANIMALS_STORE)) {
    const animals = db.createObjectStore(ANIMALS_STORE, { keyPath: 'id' })
    animals.createIndex('name', 'name', { unique: false })
    animals.createIndex('archived', 'archived', { unique: false })
  } else if (tx.objectStoreNames.contains(ANIMALS_STORE)) {
    const animalsStore = tx.objectStore(ANIMALS_STORE)
    if (!animalsStore.indexNames.contains('name')) {
      animalsStore.createIndex('name', 'name', { unique: false })
    }
    if (!animalsStore.indexNames.contains('archived')) {
      animalsStore.createIndex('archived', 'archived', { unique: false })
    }
  }
}

function wireDatabase(db: IDBDatabase): IDBDatabase {
  cachedDb = db
  db.onclose = () => {
    if (cachedDb === db) {
      cachedDb = null
      dbPromise = null
      migrationPromise = null
      schemaReadyFor = null
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
      schemaReadyFor = null
    }
  }
  return db
}

function openAtVersion(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest
    let settled = false
    let blockedTimer: ReturnType<typeof setTimeout> | null = null

    const cleanup = () => {
      if (blockedTimer) {
        clearTimeout(blockedTimer)
        blockedTimer = null
      }
    }

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      cleanup()
      rememberTechnicalError(error)
      if (error instanceof StorageError) {
        reject(error)
        return
      }
      reject(
        new StorageError(
          STORAGE_LOAD_ERROR,
          formatDomException(error),
          error instanceof Error ? error.name : null,
        ),
      )
    }

    const succeed = (db: IDBDatabase) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(db)
    }

    try {
      request =
        version === undefined
          ? getFactory().open(DB_NAME)
          : getFactory().open(DB_NAME, version)
    } catch (error) {
      fail(error)
      return
    }

    request.onupgradeneeded = () => {
      try {
        const db = request.result
        const tx = request.transaction
        if (!tx) {
          throw new StorageError(
            STORAGE_LOAD_ERROR,
            'InvalidStateError: upgrade transaction missing during onupgradeneeded.',
            'InvalidStateError',
          )
        }
        ensureObjectStores(db, tx)
      } catch (error) {
        fail(error)
      }
    }

    request.onsuccess = () => succeed(request.result)
    request.onerror = () => {
      const err = request.error
      fail(
        new StorageError(
          STORAGE_LOAD_ERROR,
          err ? formatDomException(err) : 'Could not open database.',
          err?.name ?? 'OpenError',
        ),
      )
    }
    request.onblocked = () => {
      if (settled || blockedTimer) return
      blockedTimer = setTimeout(() => {
        fail(
          new StorageError(
            STORAGE_LOAD_ERROR,
            'AbortError: Database upgrade blocked by another open connection.',
            'AbortError',
          ),
        )
      }, BLOCKED_WAIT_MS)
    }
  })
}

async function openDatabaseInternal(attempt = 0): Promise<IDBDatabase> {
  const version = targetDbVersion()
  try {
    const db = await openAtVersion(version)
    return wireDatabase(db)
  } catch (error) {
    const technical = formatDomException(error)
    const errorName =
      error instanceof StorageError
        ? error.errorName
        : error instanceof Error
          ? error.name
          : null

    // Requesting a lower version than an existing DB raises VersionError.
    // Never delete or reopen with a lower version.
    if (errorName === 'VersionError' || technical.includes('VersionError')) {
      throw new StorageError(
        STORAGE_LOAD_ERROR,
        `VersionError: existing database is newer than this app supports (${version}). The database was not modified.`,
        'VersionError',
      )
    }

    const isBlocked =
      technical.includes('blocked') || errorName === 'AbortError'

    if (isBlocked && attempt < BLOCKED_RETRY_LIMIT) {
      await resetDatabaseConnection()
      await new Promise((resolve) => setTimeout(resolve, 350))
      return openDatabaseInternal(attempt + 1)
    }

    throw error instanceof StorageError
      ? error
      : new StorageError(
          STORAGE_LOAD_ERROR,
          technical,
          error instanceof Error ? error.name : null,
        )
  }
}

/**
 * Probe IndexedDB with a real open() — never use indexedDB.databases().
 */
export async function probeIndexedDBOpen(): Promise<{
  ok: boolean
  version: number | null
  stores: string[]
  technical: string | null
}> {
  try {
    await resetDatabaseConnection()
    const db = await openDatabaseInternal()
    const stores = [...db.objectStoreNames]
    const version = db.version
    return { ok: true, version, stores, technical: null }
  } catch (error) {
    return {
      ok: false,
      version: null,
      stores: [],
      technical: formatDomException(error),
    }
  }
}

async function openDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseInternal()
      .then((db) => db)
      .catch((error) => {
        // Never permanently cache a rejected open promise.
        dbPromise = null
        cachedDb = null
        schemaReadyFor = null
        throw error
      })
  }

  const db = await dbPromise
  cachedDb = db
  await ensureAnimalMigration(db)
  return db
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      const err = request.error
      reject(
        new StorageError(
          STORAGE_SAVE_ERROR,
          err ? formatDomException(err) : 'Storage request failed.',
          err?.name ?? 'RequestError',
        ),
      )
    }
  })
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => {
      const err = tx.error
      reject(
        new StorageError(
          STORAGE_SAVE_ERROR,
          err ? formatDomException(err) : 'Storage transaction failed.',
          err?.name ?? 'TransactionError',
        ),
      )
    }
    tx.onabort = () => {
      const err = tx.error
      reject(
        new StorageError(
          STORAGE_SAVE_ERROR,
          err ? formatDomException(err) : 'Storage transaction aborted.',
          err?.name ?? 'AbortError',
        ),
      )
    }
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
  if (schemaReadyFor === db && migrationPromise) {
    await migrationPromise
    return
  }

  if (migrationPromise) {
    await migrationPromise
    if (schemaReadyFor === db) return
  }

  migrationPromise = (async () => {
    if (!hasCompleteSchema(db)) {
      // Schema incomplete at current version — bump once and reopen so
      // onupgradeneeded can create missing stores/indexes. Never delete data.
      repairTargetVersion = Math.max(db.version + 1, DB_VERSION + 1)
      try {
        db.close()
      } catch {
        // ignore
      }
      cachedDb = null
      dbPromise = null
      schemaReadyFor = null
      throw new StorageError(
        STORAGE_LOAD_ERROR,
        `InvalidStateError: Incomplete schema detected at version ${db.version} (missing animals store or indexes). Reopen required for repair upgrade to ${repairTargetVersion}.`,
        'InvalidStateError',
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

    schemaReadyFor = db
  })().catch((error) => {
    migrationPromise = null
    schemaReadyFor = null
    rememberTechnicalError(error)
    throw error instanceof StorageError
      ? error
      : new StorageError(
          STORAGE_LOAD_ERROR,
          formatDomException(error),
          error instanceof Error ? error.name : null,
        )
  })

  await migrationPromise
}

async function openDatabaseWithRepair(): Promise<IDBDatabase> {
  try {
    const db = await openDatabase()
    repairTargetVersion = null
    return db
  } catch (error) {
    const technical = formatDomException(error)
    const needsRepair =
      technical.includes('Incomplete schema') ||
      technical.includes('Animals store missing')
    if (!needsRepair) throw error

    // Force a clean reopen so onupgradeneeded can repair missing stores/indexes.
    await resetDatabaseConnection()
    const db = await openDatabase()
    repairTargetVersion = null
    return db
  }
}

export async function fetchAnimals(): Promise<Animal[]> {
  try {
    const db = await openDatabaseWithRepair()
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
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      formatDomException(error),
      error instanceof Error ? error.name : null,
    )
  }
}

export async function putAnimal(animal: Animal): Promise<Animal> {
  const normalized = normalizeAnimal(animal)
  try {
    const db = await openDatabaseWithRepair()
    const tx = db.transaction(ANIMALS_STORE, 'readwrite')
    tx.objectStore(ANIMALS_STORE).put(normalized)
    await txDone(tx)
    return normalized
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      formatDomException(error),
      error instanceof Error ? error.name : null,
    )
  }
}

export async function putManyAnimals(animals: Animal[]): Promise<void> {
  try {
    const db = await openDatabaseWithRepair()
    const tx = db.transaction(ANIMALS_STORE, 'readwrite')
    const store = tx.objectStore(ANIMALS_STORE)
    for (const animal of animals) {
      store.put(normalizeAnimal(animal))
    }
    await txDone(tx)
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      formatDomException(error),
      error instanceof Error ? error.name : null,
    )
  }
}

export async function fetchEvents(): Promise<BathroomEvent[]> {
  try {
    const db = await openDatabaseWithRepair()
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
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      formatDomException(error),
      error instanceof Error ? error.name : null,
    )
  }
}

export async function putEvent(event: BathroomEvent): Promise<BathroomEvent> {
  if (!event.animalId) {
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      'Cannot save an event without animalId.',
      'ValidationError',
    )
  }
  const normalized = normalizeEvent(event)
  try {
    const db = await openDatabaseWithRepair()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    tx.objectStore(EVENTS_STORE).put(normalized)
    await txDone(tx)
    return normalized
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      formatDomException(error),
      error instanceof Error ? error.name : null,
    )
  }
}

export async function putManyEvents(events: BathroomEvent[]): Promise<void> {
  try {
    const db = await openDatabaseWithRepair()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    const store = tx.objectStore(EVENTS_STORE)
    for (const event of events) {
      if (!event.animalId) {
        throw new StorageError(
          STORAGE_SAVE_ERROR,
          'Cannot save an event without animalId.',
          'ValidationError',
        )
      }
      store.put(normalizeEvent(event))
    }
    await txDone(tx)
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      formatDomException(error),
      error instanceof Error ? error.name : null,
    )
  }
}

export async function deleteEvent(id: string): Promise<void> {
  try {
    const db = await openDatabaseWithRepair()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    tx.objectStore(EVENTS_STORE).delete(id)
    await txDone(tx)
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      formatDomException(error),
      error instanceof Error ? error.name : null,
    )
  }
}

export async function deleteAllEvents(): Promise<void> {
  try {
    const db = await openDatabaseWithRepair()
    const tx = db.transaction(EVENTS_STORE, 'readwrite')
    tx.objectStore(EVENTS_STORE).clear()
    await txDone(tx)
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      formatDomException(error),
      error instanceof Error ? error.name : null,
    )
  }
}

export async function fetchSettings(): Promise<AppSettings> {
  try {
    const db = await openDatabaseWithRepair()
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
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      formatDomException(error),
      error instanceof Error ? error.name : null,
    )
  }
}

export async function saveSettings(
  settings: AppSettings,
): Promise<AppSettings> {
  const next = normalizeSettings(settings)
  delete next.catName
  try {
    const db = await openDatabaseWithRepair()
    const tx = db.transaction(SETTINGS_STORE, 'readwrite')
    tx.objectStore(SETTINGS_STORE).put({ key: SETTINGS_KEY, ...next })
    await txDone(tx)
    return next
  } catch (error) {
    rememberTechnicalError(error)
    if (error instanceof StorageError) throw error
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      formatDomException(error),
      error instanceof Error ? error.name : null,
    )
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
  schemaReadyFor = null
  // Keep repairTargetVersion across connection resets during an active repair.
}

export async function recoverStorage(): Promise<void> {
  await resetDatabaseConnection()
  lastTechnicalError = null
  await openDatabaseWithRepair()
  repairTargetVersion = null
}

/**
 * Destructive reset — only for explicit user action in Settings → Diagnostics.
 * Never called automatically.
 */
export async function resetLocalLitterLogStorage(): Promise<void> {
  await resetDatabaseConnection()
  await new Promise<void>((resolve, reject) => {
    const request = getFactory().deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () =>
      reject(
        new StorageError(
          STORAGE_LOAD_ERROR,
          request.error
            ? formatDomException(request.error)
            : 'Could not reset local storage.',
          request.error?.name ?? 'DeleteError',
        ),
      )
    request.onblocked = () => {
      // Still resolve — Safari may fire blocked then success.
      window.setTimeout(() => resolve(), BLOCKED_WAIT_MS)
    }
  })
  lastTechnicalError = null
  cachedDb = null
  dbPromise = null
  migrationPromise = null
  schemaReadyFor = null
  repairTargetVersion = null
}

export async function deleteDatabaseForTests(): Promise<void> {
  await resetLocalLitterLogStorage()
}

/** Exported for tests that need to assert migration defaults. */
export function defaultSelectedAnimalIdFor(animals: Animal[]): string | null {
  return pickDefaultSelectedAnimalId(animals)
}

/** Test helper: expose whether a rejected promise can stick around. */
export function getCachedOpenPromiseForTests(): Promise<IDBDatabase> | null {
  return dbPromise
}
