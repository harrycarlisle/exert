import {
  createSeedAnimals,
  createUnassignedAnimal,
  findAnimalByName,
  isReliableLegacyCatName,
  nextActiveAnimalId,
  normalizeAnimalName,
} from '../lib/animals'
import { toISO } from '../lib/dates'
import {
  CURRENT_ANIMAL_SCHEMA,
  CURRENT_EVENT_SCHEMA,
  CURRENT_SETTINGS_SCHEMA,
  DEFAULT_SETTINGS,
  STORAGE_LOAD_ERROR,
  STORAGE_SAVE_ERROR,
  isBathroomEventType,
  type Animal,
  type AppSettings,
  type BathroomEvent,
} from '../models/types'
import { StorageError, formatDomException, getErrorName } from './storageTypes'

export const LS_DOCUMENT_KEY = 'litter-log:document:v1'
export const LS_AUTHORITY_KEY = 'litter-log:authority'
export const LS_DOCUMENT_SCHEMA = 1

export interface LitterLogLocalDocument {
  schemaVersion: number
  animals: Animal[]
  events: BathroomEvent[]
  settings: AppSettings
  updatedAt: string
}

function getLocalStorage(): Storage {
  try {
    if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
      throw new StorageError(
        STORAGE_LOAD_ERROR,
        'localStorage is not available in this browser.',
        'Unavailable',
        'detect',
      )
    }
    const storage = globalThis.localStorage
    // Touch to surface SecurityError in restricted contexts.
    const probeKey = 'litter-log:probe'
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)
    return storage
  } catch (error) {
    throw error instanceof StorageError
      ? error
      : new StorageError(
          STORAGE_LOAD_ERROR,
          formatDomException(error),
          getErrorName(error) ?? 'SecurityError',
          'detect',
        )
  }
}

export function isLocalStorageAvailable(): boolean {
  try {
    getLocalStorage()
    return true
  } catch {
    return false
  }
}

export function readAuthorityMarker(): 'indexeddb' | 'localstorage' | null {
  try {
    const value = getLocalStorage().getItem(LS_AUTHORITY_KEY)
    if (value === 'indexeddb' || value === 'localstorage') return value
    return null
  } catch {
    return null
  }
}

export function writeAuthorityMarker(
  authority: 'indexeddb' | 'localstorage',
): void {
  getLocalStorage().setItem(LS_AUTHORITY_KEY, authority)
}

function emptyDocument(): LitterLogLocalDocument {
  return {
    schemaVersion: LS_DOCUMENT_SCHEMA,
    animals: [],
    events: [],
    settings: { ...DEFAULT_SETTINGS },
    updatedAt: toISO(),
  }
}

function isAnimal(value: unknown): value is Animal {
  if (!value || typeof value !== 'object') return false
  const row = value as Animal
  return (
    typeof row.id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.createdAt === 'string' &&
    typeof row.archived === 'boolean'
  )
}

function isEvent(value: unknown): value is BathroomEvent {
  if (!value || typeof value !== 'object') return false
  const row = value as BathroomEvent
  return (
    typeof row.id === 'string' &&
    typeof row.animalId === 'string' &&
    isBathroomEventType(row.type) &&
    typeof row.timestamp === 'string' &&
    typeof row.createdAt === 'string'
  )
}

export function parseLocalDocument(raw: string): LitterLogLocalDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      `Malformed localStorage JSON: ${formatDomException(error)}`,
      'SyntaxError',
      'open',
    )
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      'localStorage document is not an object.',
      'ValidationError',
      'open',
    )
  }
  const doc = parsed as Partial<LitterLogLocalDocument>
  if (doc.schemaVersion !== LS_DOCUMENT_SCHEMA) {
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      `Unsupported localStorage schema version: ${String(doc.schemaVersion)}`,
      'VersionError',
      'open',
    )
  }
  if (!Array.isArray(doc.animals) || !doc.animals.every(isAnimal)) {
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      'localStorage document has invalid animals.',
      'ValidationError',
      'open',
    )
  }
  if (!Array.isArray(doc.events) || !doc.events.every(isEvent)) {
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      'localStorage document has invalid events.',
      'ValidationError',
      'open',
    )
  }
  if (!doc.settings || typeof doc.settings !== 'object') {
    throw new StorageError(
      STORAGE_LOAD_ERROR,
      'localStorage document has invalid settings.',
      'ValidationError',
      'open',
    )
  }
  return {
    schemaVersion: LS_DOCUMENT_SCHEMA,
    animals: doc.animals.map((animal) => ({
      ...animal,
      name: normalizeAnimalName(animal.name),
      color: animal.color ?? null,
      displayOrder: animal.displayOrder ?? null,
      isSystem: Boolean(animal.isSystem),
      schemaVersion: animal.schemaVersion || CURRENT_ANIMAL_SCHEMA,
    })),
    events: doc.events.map((event) => ({
      ...event,
      note: event.note ?? null,
      source: 'web-app',
      schemaVersion: event.schemaVersion || CURRENT_EVENT_SCHEMA,
    })),
    settings: {
      ...DEFAULT_SETTINGS,
      ...doc.settings,
      schemaVersion: CURRENT_SETTINGS_SCHEMA,
    },
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : toISO(),
  }
}

export function localStorageHasData(): boolean {
  try {
    const raw = getLocalStorage().getItem(LS_DOCUMENT_KEY)
    if (!raw) return false
    const doc = parseLocalDocument(raw)
    return doc.animals.length > 0 || doc.events.length > 0
  } catch {
    return false
  }
}

function readDocument(): LitterLogLocalDocument {
  const storage = getLocalStorage()
  const raw = storage.getItem(LS_DOCUMENT_KEY)
  if (!raw) return emptyDocument()
  return parseLocalDocument(raw)
}

function writeDocumentVerified(
  doc: LitterLogLocalDocument,
): LitterLogLocalDocument {
  const storage = getLocalStorage()
  const next: LitterLogLocalDocument = {
    ...doc,
    schemaVersion: LS_DOCUMENT_SCHEMA,
    updatedAt: toISO(),
    settings: {
      ...doc.settings,
      schemaVersion: CURRENT_SETTINGS_SCHEMA,
    },
  }
  const serialized = JSON.stringify(next)
  try {
    storage.setItem(LS_DOCUMENT_KEY, serialized)
  } catch (error) {
    const name = getErrorName(error) ?? 'WriteError'
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      formatDomException(error),
      name,
      'failed',
    )
  }
  const readBack = storage.getItem(LS_DOCUMENT_KEY)
  if (readBack !== serialized) {
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      'localStorage read-back verification failed after write.',
      'VerificationError',
      'failed',
    )
  }
  return parseLocalDocument(readBack)
}

function ensureSeeded(doc: LitterLogLocalDocument): LitterLogLocalDocument {
  if (doc.animals.length > 0) {
    const selected = nextActiveAnimalId(
      doc.animals,
      doc.settings.selectedAnimalId,
    )
    if (selected !== doc.settings.selectedAnimalId) {
      return writeDocumentVerified({
        ...doc,
        settings: { ...doc.settings, selectedAnimalId: selected },
      })
    }
    return doc
  }

  const now = toISO()
  let animals = createSeedAnimals(now)
  const legacyName = doc.settings.catName
  if (isReliableLegacyCatName(legacyName)) {
    const match = findAnimalByName(animals, legacyName!)
    if (!match) {
      animals = [
        ...animals,
        {
          id: `animal_legacy_${Date.now().toString(16)}`,
          name: normalizeAnimalName(legacyName!),
          color: null,
          createdAt: now,
          archived: false,
          displayOrder: animals.length,
          isSystem: false,
          schemaVersion: CURRENT_ANIMAL_SCHEMA,
        },
      ]
    }
  } else if (doc.events.some((event) => !event.animalId)) {
    animals = [...animals, createUnassignedAnimal(now)]
  }

  const events = doc.events.map((event) => {
    if (event.animalId) return event
    const target =
      (isReliableLegacyCatName(legacyName) &&
        findAnimalByName(animals, legacyName!)?.id) ||
      animals.find((animal) => animal.isSystem)?.id ||
      animals[0]?.id
    return { ...event, animalId: target!, schemaVersion: CURRENT_EVENT_SCHEMA }
  })

  const selectedAnimalId = nextActiveAnimalId(
    animals,
    doc.settings.selectedAnimalId,
  )
  const settings = { ...doc.settings, selectedAnimalId }
  delete settings.catName

  return writeDocumentVerified({
    ...doc,
    animals,
    events,
    settings,
  })
}

export async function lsInitialize(): Promise<LitterLogLocalDocument> {
  const doc = ensureSeeded(readDocument())
  writeAuthorityMarker('localstorage')
  return doc
}

export async function lsFetchAnimals(): Promise<Animal[]> {
  const doc = ensureSeeded(readDocument())
  return [...doc.animals].sort((a, b) => {
    const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER
    const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}

export async function lsPutAnimal(animal: Animal): Promise<Animal> {
  const doc = ensureSeeded(readDocument())
  const normalized = {
    ...animal,
    name: normalizeAnimalName(animal.name),
    color: animal.color ?? null,
    schemaVersion: animal.schemaVersion || CURRENT_ANIMAL_SCHEMA,
  }
  const animals = [
    ...doc.animals.filter((item) => item.id !== normalized.id),
    normalized,
  ]
  writeDocumentVerified({ ...doc, animals })
  return normalized
}

export async function lsPutManyAnimals(animals: Animal[]): Promise<void> {
  const doc = ensureSeeded(readDocument())
  const byId = new Map(doc.animals.map((animal) => [animal.id, animal]))
  for (const animal of animals) {
    byId.set(animal.id, {
      ...animal,
      name: normalizeAnimalName(animal.name),
      color: animal.color ?? null,
      schemaVersion: animal.schemaVersion || CURRENT_ANIMAL_SCHEMA,
    })
  }
  writeDocumentVerified({ ...doc, animals: [...byId.values()] })
}

export async function lsFetchEvents(): Promise<BathroomEvent[]> {
  const doc = ensureSeeded(readDocument())
  return [...doc.events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
}

export async function lsPutEvent(event: BathroomEvent): Promise<BathroomEvent> {
  if (!event.animalId) {
    throw new StorageError(
      STORAGE_SAVE_ERROR,
      'Cannot save an event without animalId.',
      'ValidationError',
    )
  }
  const doc = ensureSeeded(readDocument())
  const normalized = {
    ...event,
    note: event.note ?? null,
    source: 'web-app' as const,
    schemaVersion: event.schemaVersion || CURRENT_EVENT_SCHEMA,
  }
  const events = [
    ...doc.events.filter((item) => item.id !== normalized.id),
    normalized,
  ]
  writeDocumentVerified({ ...doc, events })
  return normalized
}

export async function lsPutManyEvents(events: BathroomEvent[]): Promise<void> {
  const doc = ensureSeeded(readDocument())
  const byId = new Map(doc.events.map((event) => [event.id, event]))
  for (const event of events) {
    if (!event.animalId) {
      throw new StorageError(
        STORAGE_SAVE_ERROR,
        'Cannot save an event without animalId.',
        'ValidationError',
      )
    }
    byId.set(event.id, {
      ...event,
      note: event.note ?? null,
      source: 'web-app',
      schemaVersion: event.schemaVersion || CURRENT_EVENT_SCHEMA,
    })
  }
  writeDocumentVerified({ ...doc, events: [...byId.values()] })
}

export async function lsDeleteEvent(id: string): Promise<void> {
  const doc = ensureSeeded(readDocument())
  writeDocumentVerified({
    ...doc,
    events: doc.events.filter((event) => event.id !== id),
  })
}

export async function lsDeleteAllEvents(): Promise<void> {
  const doc = ensureSeeded(readDocument())
  writeDocumentVerified({ ...doc, events: [] })
}

export async function lsFetchSettings(): Promise<AppSettings> {
  const doc = ensureSeeded(readDocument())
  const settings = { ...doc.settings }
  delete settings.catName
  return settings
}

export async function lsSaveSettings(
  settings: AppSettings,
): Promise<AppSettings> {
  const doc = ensureSeeded(readDocument())
  const next = {
    ...settings,
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
  }
  delete next.catName
  writeDocumentVerified({ ...doc, settings: next })
  return next
}

/** Destructive — only via explicit Diagnostics reset for the localStorage backend. */
export async function lsResetStorage(): Promise<void> {
  const storage = getLocalStorage()
  storage.removeItem(LS_DOCUMENT_KEY)
  // Keep authority marker so we do not bounce backends unexpectedly.
}

/** Test helper — clears document and authority marker. */
export function clearLocalStorageBackendForTests(): void {
  try {
    const storage = globalThis.localStorage
    storage.removeItem(LS_DOCUMENT_KEY)
    storage.removeItem(LS_AUTHORITY_KEY)
  } catch {
    // ignore
  }
}
