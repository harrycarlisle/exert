import { STORAGE_LOAD_ERROR } from '../models/types'
import type { Animal, AppSettings, BathroomEvent } from '../models/types'
import * as idb from './database'
import {
  isLocalStorageAvailable,
  localStorageHasData,
  lsDeleteAllEvents,
  lsDeleteEvent,
  lsFetchAnimals,
  lsFetchEvents,
  lsFetchSettings,
  lsInitialize,
  lsPutAnimal,
  lsPutEvent,
  lsPutManyAnimals,
  lsPutManyEvents,
  lsResetStorage,
  lsSaveSettings,
  readAuthorityMarker,
  writeAuthorityMarker,
} from './localStorageBackend'
import {
  StorageError,
  formatDomException,
  getErrorName,
  type StorageBackendKind,
  type StorageInitStage,
} from './storageTypes'

export { StorageError } from './storageTypes'

let activeBackend: StorageBackendKind | null = null
let initPromise: Promise<StorageBackendKind> | null = null
let adapterStage: StorageInitStage = 'idle'
let lastAdapterError: StorageError | null = null
/** Soft hint only — never used to switch backends or expose record contents. */
let otherBackendHasDataHint: boolean | null = null

function setAdapterStage(stage: StorageInitStage): void {
  adapterStage = stage
}

function rememberAdapterError(error: unknown, stage?: StorageInitStage): void {
  lastAdapterError =
    error instanceof StorageError
      ? error
      : new StorageError(
          STORAGE_LOAD_ERROR,
          formatDomException(error),
          getErrorName(error),
          stage ?? 'failed',
        )
  if (stage) setAdapterStage(stage)
}

export function getActiveBackend(): StorageBackendKind | null {
  return activeBackend
}

export function getStorageAdapterDiagnostics() {
  const idbDiag = idb.getIndexedDbDiagnostics()
  const authority = readAuthorityMarker()
  let otherBackendHasData: boolean | null = otherBackendHasDataHint
  if (activeBackend === 'indexeddb') {
    otherBackendHasData = localStorageHasData()
  } else if (activeBackend === 'localstorage') {
    if (otherBackendHasDataHint == null) {
      otherBackendHasData =
        idbDiag.indexedDbOpenSucceeded === true ? true : null
    }
  }

  return {
    stage: adapterStage,
    backend: activeBackend,
    authority,
    lastErrorName: lastAdapterError?.errorName ?? idbDiag.lastErrorName ?? null,
    lastErrorMessage: lastAdapterError
      ? lastAdapterError.errorName
        ? `${lastAdapterError.errorName}: ${lastAdapterError.technicalMessage}`
        : lastAdapterError.technicalMessage
      : idbDiag.lastErrorMessage,
    lastErrorStage: lastAdapterError?.stage ?? idbDiag.lastErrorStage ?? null,
    indexedDbApiPresent: idbDiag.indexedDbApiPresent,
    indexedDbOpenSucceeded: idbDiag.indexedDbOpenSucceeded,
    localStorageAvailable: isLocalStorageAvailable(),
    otherBackendHasData,
    schemaVersion: idbDiag.schemaVersion,
  }
}

export function getLastTechnicalStorageError(): string | null {
  return getStorageAdapterDiagnostics().lastErrorMessage
}

async function tryIndexedDb(): Promise<boolean> {
  setAdapterStage('detect')
  const { factory, detectError } = idb.resolveIndexedDBFactory()
  if (!factory) {
    rememberAdapterError(detectError, 'detect')
    return false
  }
  try {
    setAdapterStage('open')
    // Fresh open path — recoverStorage clears rejected cached promises.
    await idb.recoverStorage()
    setAdapterStage('ready')
    return true
  } catch (error) {
    const stage =
      error instanceof StorageError && error.stage ? error.stage : 'open'
    rememberAdapterError(error, stage)
    return false
  }
}

/**
 * Choose authoritative backend once per session (and persist the choice).
 * Never silently merges or deletes data across backends.
 * Do not open IndexedDB for presence probing while localStorage is sticky —
 * opening would run migrations/seeding and create non-authoritative data.
 */
export async function initializeStorage(): Promise<StorageBackendKind> {
  if (activeBackend) return activeBackend
  if (initPromise) return initPromise

  initPromise = (async () => {
    const authority = readAuthorityMarker()
    const lsAvailable = isLocalStorageAvailable()
    const lsHasData = lsAvailable && localStorageHasData()

    // Sticky fallback: once localStorage holds records / is authoritative, keep it.
    // Never auto-merge, copy, or delete across backends.
    if (
      authority === 'localstorage' ||
      (lsHasData && authority !== 'indexeddb')
    ) {
      setAdapterStage('fallback')
      await lsInitialize()
      activeBackend = 'localstorage'
      writeAuthorityMarker('localstorage')
      otherBackendHasDataHint = null
      setAdapterStage('ready')
      return activeBackend
    }

    const idbOk = await tryIndexedDb()
    if (idbOk) {
      activeBackend = 'indexeddb'
      if (lsAvailable) writeAuthorityMarker('indexeddb')
      otherBackendHasDataHint = lsHasData
      setAdapterStage('ready')
      return activeBackend
    }

    if (lsAvailable) {
      setAdapterStage('fallback')
      await lsInitialize()
      activeBackend = 'localstorage'
      writeAuthorityMarker('localstorage')
      otherBackendHasDataHint = null
      setAdapterStage('ready')
      // Keep the IndexedDB failure details for diagnostics.
      return activeBackend
    }

    setAdapterStage('failed')
    throw (
      lastAdapterError ??
      new StorageError(
        STORAGE_LOAD_ERROR,
        'Both IndexedDB and localStorage are unavailable.',
        'Unavailable',
        'failed',
      )
    )
  })().finally(() => {
    initPromise = null
  })

  return initPromise
}

export async function recoverStorage(): Promise<StorageBackendKind> {
  activeBackend = null
  initPromise = null
  lastAdapterError = null
  otherBackendHasDataHint = null
  await idb.resetDatabaseConnection()
  return initializeStorage()
}

async function ensureBackend(): Promise<StorageBackendKind> {
  return initializeStorage()
}

export async function fetchAnimals(): Promise<Animal[]> {
  const backend = await ensureBackend()
  return backend === 'localstorage' ? lsFetchAnimals() : idb.fetchAnimals()
}

export async function putAnimal(animal: Animal): Promise<Animal> {
  const backend = await ensureBackend()
  return backend === 'localstorage'
    ? lsPutAnimal(animal)
    : idb.putAnimal(animal)
}

export async function putManyAnimals(animals: Animal[]): Promise<void> {
  const backend = await ensureBackend()
  return backend === 'localstorage'
    ? lsPutManyAnimals(animals)
    : idb.putManyAnimals(animals)
}

export async function fetchEvents(): Promise<BathroomEvent[]> {
  const backend = await ensureBackend()
  return backend === 'localstorage' ? lsFetchEvents() : idb.fetchEvents()
}

export async function putEvent(event: BathroomEvent): Promise<BathroomEvent> {
  const backend = await ensureBackend()
  return backend === 'localstorage' ? lsPutEvent(event) : idb.putEvent(event)
}

export async function putManyEvents(events: BathroomEvent[]): Promise<void> {
  const backend = await ensureBackend()
  return backend === 'localstorage'
    ? lsPutManyEvents(events)
    : idb.putManyEvents(events)
}

export async function deleteEvent(id: string): Promise<void> {
  const backend = await ensureBackend()
  return backend === 'localstorage' ? lsDeleteEvent(id) : idb.deleteEvent(id)
}

export async function deleteAllEvents(): Promise<void> {
  const backend = await ensureBackend()
  return backend === 'localstorage'
    ? lsDeleteAllEvents()
    : idb.deleteAllEvents()
}

export async function fetchSettings(): Promise<AppSettings> {
  const backend = await ensureBackend()
  return backend === 'localstorage' ? lsFetchSettings() : idb.fetchSettings()
}

export async function saveSettings(
  settings: AppSettings,
): Promise<AppSettings> {
  const backend = await ensureBackend()
  return backend === 'localstorage'
    ? lsSaveSettings(settings)
    : idb.saveSettings(settings)
}

export async function requestPersistentStorage(): Promise<boolean> {
  return idb.requestPersistentStorage()
}

export async function probeIndexedDBOpen() {
  return idb.probeIndexedDBOpen()
}

export async function resetLocalLitterLogStorage(): Promise<void> {
  const backend = activeBackend ?? readAuthorityMarker()
  if (backend === 'localstorage') {
    await lsResetStorage()
  } else {
    await idb.resetLocalLitterLogStorage()
  }
  activeBackend = null
  initPromise = null
  await initializeStorage()
}

/** Test helper */
export function resetAdapterForTests(): void {
  activeBackend = null
  initPromise = null
  lastAdapterError = null
  adapterStage = 'idle'
  otherBackendHasDataHint = null
}
