import { STORAGE_LOAD_ERROR } from '../models/types'

export type StorageBackendKind = 'indexeddb' | 'localstorage'

export type StorageInitStage =
  | 'idle'
  | 'detect'
  | 'open'
  | 'upgrade'
  | 'migrate'
  | 'ready'
  | 'fallback'
  | 'failed'

export class StorageError extends Error {
  readonly userMessage: string
  readonly technicalMessage: string
  readonly errorName: string | null
  readonly stage: StorageInitStage | null

  constructor(
    userMessage: string,
    technicalMessage?: string,
    errorName: string | null = null,
    stage: StorageInitStage | null = null,
  ) {
    super(userMessage)
    this.name = 'StorageError'
    this.userMessage = userMessage
    this.technicalMessage = technicalMessage ?? userMessage
    this.errorName = errorName
    this.stage = stage
  }
}

/** DOMException is not always `instanceof Error` across browsers/jsdom. */
export function getErrorName(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  if (
    'name' in error &&
    typeof (error as { name: unknown }).name === 'string'
  ) {
    return (error as { name: string }).name || null
  }
  return null
}

export function formatDomException(error: unknown): string {
  if (
    error instanceof DOMException ||
    error instanceof Error ||
    (error && typeof error === 'object' && 'message' in error)
  ) {
    const name = getErrorName(error) || 'Error'
    const message =
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
        ? (error as { message: string }).message.trim() || '(no message)'
        : '(no message)'
    const code =
      'code' in error && typeof (error as DOMException).code === 'number'
        ? ` code=${(error as DOMException).code}`
        : ''
    return `${name}: ${message}${code}`
  }
  return String(error)
}

export function toStorageError(
  error: unknown,
  userMessage = STORAGE_LOAD_ERROR,
  stage: StorageInitStage | null = null,
): StorageError {
  if (error instanceof StorageError) {
    return stage && !error.stage
      ? new StorageError(
          error.userMessage,
          error.technicalMessage,
          error.errorName,
          stage,
        )
      : error
  }
  return new StorageError(
    userMessage,
    formatDomException(error),
    getErrorName(error),
    stage,
  )
}

export interface StorageDiagnosticsSnapshot {
  stage: StorageInitStage
  backend: StorageBackendKind | null
  authority: StorageBackendKind | null
  lastErrorName: string | null
  lastErrorMessage: string | null
  lastErrorStage: StorageInitStage | null
  indexedDbApiPresent: boolean | null
  indexedDbOpenSucceeded: boolean | null
  localStorageAvailable: boolean
  otherBackendHasData: boolean | null
  schemaVersion: number | null
}
