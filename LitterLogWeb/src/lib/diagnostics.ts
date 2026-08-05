import { BUILD_SHA, BUILD_TIME, shortBuildSha } from './buildInfo'
import { isStandaloneDisplay } from './pwa'
import type { StorageBackendKind, StorageInitStage } from '../db/storageTypes'

export interface DiagnosticsInput {
  storage: {
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
  deployedSha?: string | null
  serviceWorker?: {
    supported: boolean
    scope: string | null
    activeState: string | null
    waitingState: string | null
    installingState: string | null
  }
}

function displayMode(): string {
  try {
    if (isStandaloneDisplay()) return 'standalone'
  } catch {
    // matchMedia may be unavailable in some test environments
  }
  if (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      return 'standalone'
    }
    if (window.matchMedia('(display-mode: browser)').matches) {
      return 'browser'
    }
  }
  return 'unknown'
}

export function buildDiagnosticsText(input: DiagnosticsInput): string {
  const sw = input.serviceWorker
  const lines = [
    'Litter Log diagnostics (privacy-safe; no animal or event data)',
    `timestamp: ${new Date().toISOString()}`,
    `buildSha: ${BUILD_SHA}`,
    `buildShortSha: ${shortBuildSha()}`,
    `buildTime: ${BUILD_TIME || '(unknown)'}`,
    `deployedSha: ${input.deployedSha ?? '(not checked)'}`,
    `url: ${typeof location !== 'undefined' ? location.href : '(n/a)'}`,
    `origin: ${typeof location !== 'undefined' ? location.origin : '(n/a)'}`,
    `userAgent: ${typeof navigator !== 'undefined' ? navigator.userAgent : '(n/a)'}`,
    `displayMode: ${displayMode()}`,
    `isSecureContext: ${typeof isSecureContext !== 'undefined' ? String(isSecureContext) : '(n/a)'}`,
    `online: ${typeof navigator !== 'undefined' ? String(navigator.onLine) : '(n/a)'}`,
    `indexedDbApiPresent: ${String(input.storage.indexedDbApiPresent)}`,
    `indexedDbOpenSucceeded: ${String(input.storage.indexedDbOpenSucceeded)}`,
    `localStorageAvailable: ${String(input.storage.localStorageAvailable)}`,
    `authoritativeBackend: ${input.storage.backend ?? '(none)'}`,
    `authorityMarker: ${input.storage.authority ?? '(none)'}`,
    `otherBackendHasData: ${String(input.storage.otherBackendHasData)}`,
    `schemaVersion: ${input.storage.schemaVersion ?? '(n/a)'}`,
    `initStage: ${input.storage.stage}`,
    `lastErrorName: ${input.storage.lastErrorName ?? '(none)'}`,
    `lastErrorMessage: ${input.storage.lastErrorMessage ?? '(none)'}`,
    `lastErrorStage: ${input.storage.lastErrorStage ?? '(none)'}`,
    `serviceWorkerSupported: ${String(sw?.supported ?? false)}`,
    `serviceWorkerScope: ${sw?.scope ?? '(n/a)'}`,
    `serviceWorkerActive: ${sw?.activeState ?? '(n/a)'}`,
    `serviceWorkerWaiting: ${sw?.waitingState ?? '(n/a)'}`,
    `serviceWorkerInstalling: ${sw?.installingState ?? '(n/a)'}`,
  ]
  return `${lines.join('\n')}\n`
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

export async function readServiceWorkerDiagnostics(): Promise<
  DiagnosticsInput['serviceWorker']
> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return {
      supported: false,
      scope: null,
      activeState: null,
      waitingState: null,
      installingState: null,
    }
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    return {
      supported: true,
      scope: registration?.scope ?? null,
      activeState: registration?.active?.state ?? null,
      waitingState: registration?.waiting?.state ?? null,
      installingState: registration?.installing?.state ?? null,
    }
  } catch {
    return {
      supported: true,
      scope: null,
      activeState: null,
      waitingState: null,
      installingState: null,
    }
  }
}
