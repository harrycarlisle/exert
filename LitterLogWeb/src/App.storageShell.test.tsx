import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { deleteDatabaseForTests, setIndexedDBFactory } from './db/database'
import { clearLocalStorageBackendForTests } from './db/localStorageBackend'
import { resetAdapterForTests } from './db/storageAdapter'

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}))

describe('app shell during storage states', () => {
  beforeEach(async () => {
    resetAdapterForTests()
    clearLocalStorageBackendForTests()
    setIndexedDBFactory(null)
    await deleteDatabaseForTests()
  })

  it('keeps the app shell visible during initialization and shows the main interface when storage works', async () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Litter Log' })).toBeVisible()
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Cleo' })).toBeVisible()
    })
    expect(screen.getByRole('button', { name: /^Pee$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Poo$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Tried to Pee$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Add animal' })).toBeVisible()
  })

  it('shows the normal interface when IndexedDB fails and localStorage fallback succeeds', async () => {
    setIndexedDBFactory({
      open() {
        throw new DOMException('idb down', 'UnknownError')
      },
    } as unknown as IDBFactory)

    render(<App />)
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: 'Cleo' })).toBeVisible()
    })
    expect(
      screen.queryByText(/couldn’t access storage/i),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Pee$/ })).toBeVisible()
  })

  it('keeps shell/settings accessible and shows one storage notice when both backends fail', async () => {
    setIndexedDBFactory({
      open() {
        throw new DOMException('idb down', 'UnknownError')
      },
    } as unknown as IDBFactory)
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new DOMException('blocked', 'SecurityError')
    }

    try {
      render(<App />)
      expect(screen.getByRole('heading', { name: 'Litter Log' })).toBeVisible()
      await waitFor(() => {
        expect(
          screen.getByText(/couldn’t access storage on this device/i),
        ).toBeVisible()
      })
      expect(
        screen.getAllByText(/couldn’t access storage on this device/i),
      ).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible()
      expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible()
      expect(screen.queryByRole('button', { name: /^Pee$/ })).toBeNull()
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
