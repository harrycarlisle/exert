import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteDatabaseForTests,
  getIndexedDbDiagnostics,
  probeIndexedDBOpen,
  resetDatabaseConnection,
  resolveIndexedDBFactory,
  setIndexedDBFactory,
  StorageError,
} from './database'

describe('IndexedDB availability detection', () => {
  beforeEach(async () => {
    setIndexedDBFactory(null)
    await deleteDatabaseForTests()
    await resetDatabaseConnection()
  })

  afterEach(async () => {
    setIndexedDBFactory(null)
    await resetDatabaseConnection()
  })

  it('runs detection against browser globals and finds a factory with open()', () => {
    const { factory, detectError } = resolveIndexedDBFactory()
    expect(detectError).toBeNull()
    expect(factory).toBeTruthy()
    expect(typeof factory?.open).toBe('function')
  })

  it('identifies a genuine missing IndexedDB API as a detect-stage Unavailable error', () => {
    const original = globalThis.indexedDB
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined,
    })
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'indexedDB', {
        configurable: true,
        value: undefined,
      })
    }

    try {
      const { factory, detectError } = resolveIndexedDBFactory()
      expect(factory).toBeNull()
      expect(detectError).toBeInstanceOf(StorageError)
      expect(detectError?.errorName).toBe('Unavailable')
      expect(detectError?.stage).toBe('detect')
      expect(detectError?.technicalMessage).toMatch(/IndexedDB/i)
      expect(getIndexedDbDiagnostics().indexedDbApiPresent).toBe(false)
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', {
        configurable: true,
        value: original,
      })
      if (typeof window !== 'undefined') {
        Object.defineProperty(window, 'indexedDB', {
          configurable: true,
          value: original,
        })
      }
    }
  })

  it('preserves open-stage errors when indexedDB.open() throws', async () => {
    setIndexedDBFactory({
      open() {
        throw new DOMException('blocked by policy', 'SecurityError')
      },
    } as unknown as IDBFactory)

    const result = await probeIndexedDBOpen()
    expect(result.ok).toBe(false)
    expect(result.stage).toBe('open')
    expect(result.errorName).toBe('SecurityError')
    expect(result.technical).toMatch(/SecurityError/)
    expect(result.apiPresent).toBe(true)
  })

  it('preserves open-stage errors when indexedDB.open() rejects', async () => {
    setIndexedDBFactory({
      open() {
        const request = {
          result: null,
          error: new DOMException('open failed', 'UnknownError'),
          onsuccess: null as ((ev: Event) => void) | null,
          onerror: null as ((ev: Event) => void) | null,
          onupgradeneeded: null as ((ev: Event) => void) | null,
          onblocked: null as ((ev: Event) => void) | null,
        }
        queueMicrotask(() => {
          request.onerror?.(new Event('error'))
        })
        return request as unknown as IDBOpenDBRequest
      },
    } as unknown as IDBFactory)

    const result = await probeIndexedDBOpen()
    expect(result.ok).toBe(false)
    expect(result.stage).toBe('open')
    expect(result.errorName).toBe('UnknownError')
  })

  it('allows a failed open to be retried with a fresh request', async () => {
    let calls = 0
    setIndexedDBFactory({
      open(name: string, version?: number) {
        calls += 1
        if (calls === 1) {
          throw new DOMException('temporary failure', 'UnknownError')
        }
        return indexedDB.open(name, version)
      },
    } as unknown as IDBFactory)

    const first = await probeIndexedDBOpen()
    expect(first.ok).toBe(false)

    const second = await probeIndexedDBOpen()
    expect(second.ok).toBe(true)
    expect(calls).toBeGreaterThanOrEqual(2)
  })

  it('does not permanently cache a rejected open promise', async () => {
    const openSpy = vi.fn((name: string, version?: number) => {
      if (openSpy.mock.calls.length === 1) {
        throw new DOMException('first fail', 'UnknownError')
      }
      return indexedDB.open(name, version)
    })
    setIndexedDBFactory({ open: openSpy } as unknown as IDBFactory)

    await expect(probeIndexedDBOpen()).resolves.toMatchObject({ ok: false })
    await expect(probeIndexedDBOpen()).resolves.toMatchObject({ ok: true })
    expect(openSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
