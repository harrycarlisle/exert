import { BUILD_SHA, fetchDeployedVersion, shortBuildSha } from './buildInfo'

export type UpdateCheckStatus =
  'idle' | 'checking' | 'latest' | 'ready' | 'updating' | 'installed' | 'error'

export function updateStatusMessage(status: UpdateCheckStatus): string | null {
  switch (status) {
    case 'checking':
      return 'Checking…'
    case 'latest':
      return 'You’re using the latest version.'
    case 'ready':
      return 'An update is ready.'
    case 'updating':
      return 'Updating…'
    case 'installed':
      return 'Update installed.'
    case 'error':
      return 'Couldn’t check for updates. Try again.'
    default:
      return null
  }
}

export async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null
  }
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null
  } catch {
    return null
  }
}

export async function checkForAppUpdate(options?: {
  knownWaiting?: boolean
}): Promise<{
  status: Exclude<UpdateCheckStatus, 'idle' | 'updating' | 'installed'>
  deployedSha: string | null
  waiting: boolean
}> {
  let deployedSha: string | null = null
  try {
    const deployed = await fetchDeployedVersion()
    deployedSha = deployed.sha
  } catch {
    // version.json may fail offline; still try registration.update().
  }

  const registration = await getServiceWorkerRegistration()
  if (registration) {
    try {
      await registration.update()
    } catch {
      // ignore update() network failures; version compare still useful
    }
  }

  const waiting = Boolean(
    options?.knownWaiting || registration?.waiting || registration?.installing,
  )

  if (waiting) {
    return { status: 'ready', deployedSha, waiting: true }
  }

  if (!deployedSha) {
    return { status: 'error', deployedSha: null, waiting: false }
  }

  if (
    deployedSha === BUILD_SHA ||
    shortBuildSha(deployedSha) === shortBuildSha()
  ) {
    return { status: 'latest', deployedSha, waiting: false }
  }

  // Deployed SHA differs but worker not waiting yet — treat as not ready.
  return { status: 'latest', deployedSha, waiting: false }
}

export async function activateWaitingServiceWorker(): Promise<boolean> {
  const registration = await getServiceWorkerRegistration()
  const waiting = registration?.waiting
  if (!waiting) return false
  waiting.postMessage({ type: 'SKIP_WAITING' })
  return true
}
