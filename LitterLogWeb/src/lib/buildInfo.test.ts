import { describe, expect, it, vi } from 'vitest'
import { BUILD_SHA, fetchDeployedVersion, shortBuildSha } from './buildInfo'
import { checkForAppUpdate, updateStatusMessage } from './appUpdates'
import { buildDiagnosticsText } from './diagnostics'

describe('build identifier and updates', () => {
  it('exposes a running build identifier', () => {
    expect(typeof BUILD_SHA).toBe('string')
    expect(BUILD_SHA.length).toBeGreaterThan(0)
    expect(shortBuildSha(BUILD_SHA).length).toBeGreaterThan(0)
  })

  it('fetches version.json with cache bypass', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        sha: 'abcdef0123456789',
        shortSha: 'abcdef0',
        builtAt: '2026-08-05T00:00:00.000Z',
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const info = await fetchDeployedVersion('/exert/')
    expect(info.sha).toBe('abcdef0123456789')
    expect(info.shortSha).toBe('abcdef0')
    expect(fetchMock).toHaveBeenCalled()
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/exert/version.json?')
    expect(init.cache).toBe('no-store')
    vi.unstubAllGlobals()
  })

  it('keeps Check for updates messaging concise', () => {
    expect(updateStatusMessage('checking')).toBe('Checking…')
    expect(updateStatusMessage('latest')).toMatch(/latest version/)
    expect(updateStatusMessage('ready')).toMatch(/update is ready/)
    expect(updateStatusMessage('error')).toMatch(/Couldn’t check/)
  })

  it('treats a waiting worker as an update ready state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sha: BUILD_SHA,
          shortSha: shortBuildSha(),
          builtAt: '2026-08-05T00:00:00.000Z',
        }),
      }),
    )
    vi.stubGlobal('navigator', {
      ...navigator,
      serviceWorker: {
        getRegistration: async () => ({
          update: async () => undefined,
          waiting: { state: 'installed' },
          installing: null,
          active: { state: 'activated' },
        }),
      },
    })

    const result = await checkForAppUpdate()
    expect(result.status).toBe('ready')
    expect(result.waiting).toBe(true)
    vi.unstubAllGlobals()
  })

  it('builds privacy-safe diagnostics without record contents', () => {
    const text = buildDiagnosticsText({
      storage: {
        stage: 'ready',
        backend: 'localstorage',
        authority: 'localstorage',
        lastErrorName: 'Unavailable',
        lastErrorMessage: 'Unavailable: IndexedDB factory missing',
        lastErrorStage: 'detect',
        indexedDbApiPresent: false,
        indexedDbOpenSucceeded: false,
        localStorageAvailable: true,
        otherBackendHasData: null,
        schemaVersion: null,
      },
      deployedSha: 'abc',
      serviceWorker: {
        supported: true,
        scope: '/exert/',
        activeState: 'activated',
        waitingState: null,
        installingState: null,
      },
    })
    expect(text).toContain('buildSha:')
    expect(text).toContain('authoritativeBackend: localstorage')
    expect(text).not.toMatch(/Cleo|Bower|pee|poo|note/i)
  })
})
