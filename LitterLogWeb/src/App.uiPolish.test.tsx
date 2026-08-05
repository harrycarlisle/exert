import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { contrastRatio } from './lib/contrast'
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

async function readyHome() {
  render(<App />)
  await waitFor(() => {
    expect(screen.getByRole('radio', { name: 'Cleo' })).toBeVisible()
  })
  const dismiss = screen.queryByRole('button', { name: 'Dismiss' })
  if (dismiss) await userEvent.click(dismiss)
}

describe('final UI polish', () => {
  beforeEach(async () => {
    vi.useRealTimers()
    resetAdapterForTests()
    clearLocalStorageBackendForTests()
    setIndexedDBFactory(null)
    await deleteDatabaseForTests()
    sessionStorage.clear()
  })

  it('shows a floating success toast that does not grow page layout', async () => {
    await readyHome()
    const beforeHeight = document.documentElement.scrollHeight
    await userEvent.click(screen.getByRole('button', { name: /^Pee$/ }))
    const toast = await screen.findByTestId('status-toast')
    expect(toast).toHaveTextContent(/Pee logged for Cleo/i)
    expect(toast.closest('.toast-layer')).toBeTruthy()
    expect(toast.closest('.toast-layer')?.parentElement).toBe(
      document.querySelector('.app-shell'),
    )
    expect(screen.queryByRole('button', { name: 'Dismiss status' })).toBeNull()
    // Overlay toast must not grow document layout.
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(
      beforeHeight + 1,
    )
  })

  it('does not show a success toast after failed persistence', async () => {
    setIndexedDBFactory({
      open() {
        throw new DOMException('idb down', 'UnknownError')
      },
    } as unknown as IDBFactory)
    const original = Storage.prototype.setItem
    let blocking = false
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (blocking && String(key).includes('litter-log:document')) {
        throw new DOMException('quota', 'QuotaExceededError')
      }
      return original.call(this, key, value)
    }

    try {
      await readyHome()
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: 'Cleo' })).toBeVisible()
      })
      blocking = true
      await userEvent.click(screen.getByRole('button', { name: /^Pee$/ }))
      await waitFor(() => {
        expect(screen.getByTestId('status-toast')).toHaveTextContent(
          /couldn’t access storage/i,
        )
      })
      expect(screen.getByTestId('status-toast')).toHaveClass('error')
      expect(screen.getByTestId('status-toast')).not.toHaveTextContent(
        /Pee logged/i,
      )
    } finally {
      Storage.prototype.setItem = original
    }
  })

  it('auto-dismisses the success toast and Undo removes the saved entry', async () => {
    await readyHome()
    await userEvent.click(screen.getByRole('button', { name: /^Pee$/ }))
    expect(await screen.findByTestId('status-toast')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeVisible()

    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => {
      expect(screen.getByTestId('status-toast')).toHaveTextContent(
        /Entry undone/i,
      )
    })
    expect(screen.queryByRole('heading', { name: 'Recent' })).toBeNull()

    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
    await userEvent.click(screen.getByRole('button', { name: /^Pee$/ }))
    expect(await screen.findByTestId('status-toast')).toHaveTextContent(
      /Pee logged/i,
    )
    const dismissCall = setTimeoutSpy.mock.calls.find(
      (call) => call[1] === 5000,
    )
    expect(dismissCall).toBeTruthy()
    await act(async () => {
      ;(dismissCall![0] as TimerHandler as () => void)()
    })
    expect(screen.queryByTestId('status-toast')).toBeNull()
    setTimeoutSpy.mockRestore()
  })

  it('keeps Pee/Poo permanent and collapses Tried to Pee behind disclosure', async () => {
    await readyHome()
    expect(screen.getByRole('button', { name: /^Pee$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Poo$/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Tried to Pee$/ })).toBeNull()

    const disclosure = screen.getByRole('button', {
      name: 'More logging options',
    })
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(disclosure).toHaveAttribute('aria-controls')

    await userEvent.click(disclosure)
    expect(disclosure).toHaveAttribute('aria-expanded', 'true')
    expect(sessionStorage.getItem('litter-log:more-logging-open')).toBe('1')
    const tried = screen.getByRole('button', { name: /^Tried to Pee$/ })
    expect(tried).toBeVisible()
    await userEvent.click(tried)
    expect(await screen.findByTestId('status-toast')).toHaveTextContent(
      /Tried to pee logged for Cleo/i,
    )

    await userEvent.click(disclosure)
    expect(disclosure).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('button', { name: /^Tried to Pee$/ })).toBeNull()
    expect(sessionStorage.getItem('litter-log:more-logging-open')).toBe('0')
  })

  it('updates Today counts after logging and uses overflow actions for Recent', async () => {
    await readyHome()
    expect(screen.getByText('Today · Cleo')).toBeVisible()
    expect(screen.getByTestId('today-stats')).toHaveTextContent('0 Pees')

    await userEvent.click(screen.getByRole('button', { name: /^Pee$/ }))
    await waitFor(() => {
      expect(screen.getByTestId('today-stats')).toHaveTextContent('1 Pee')
    })

    const actions = await screen.findByRole('button', {
      name: /Actions for Pee logged at/i,
    })
    expect(screen.queryByRole('button', { name: /^Edit$/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Delete$/ })).toBeNull()

    await userEvent.click(actions)
    const menu = screen.getByRole('menu')
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Edit' }))
    expect(screen.getByRole('dialog', { name: 'Edit Entry' })).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await userEvent.click(
      screen.getByRole('button', { name: /Actions for Pee logged at/i }),
    )
    await userEvent.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'Delete',
      }),
    )
    const confirm = await screen.findByRole('dialog', {
      name: 'Delete this entry?',
    })
    await userEvent.click(
      within(confirm).getByRole('button', { name: 'Delete' }),
    )
    await waitFor(() => {
      expect(screen.getByTestId('today-stats')).toHaveTextContent('0 Pees')
    })
  })

  it('keeps View All History as a quiet control that opens History', async () => {
    await readyHome()
    await userEvent.click(screen.getByRole('button', { name: /^Pee$/ }))
    const historyLink = await screen.findByRole('button', {
      name: /View All History/i,
    })
    expect(historyLink).toHaveClass('history-link')
    await userEvent.click(historyLink)
    expect(screen.getByRole('heading', { name: 'History' })).toBeVisible()
  })

  it('selected animal teal meets WCAG AA contrast for white text', () => {
    expect(contrastRatio('#ffffff', '#2e6f73')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', '#246e73')).toBeGreaterThanOrEqual(4.5)
    // Previous dark-mode accent fill fails AA and must not be used for selected text.
    expect(contrastRatio('#ffffff', '#4f9ea3')).toBeLessThan(4.5)
  })

  it('preserves selected semantic state on animal pills', async () => {
    await readyHome()
    const cleo = screen.getByRole('radio', { name: 'Cleo' })
    expect(cleo).toHaveAttribute('aria-checked', 'true')
    await userEvent.click(screen.getByRole('radio', { name: 'Bower' }))
    expect(screen.getByRole('radio', { name: 'Bower' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(cleo).toHaveAttribute('aria-checked', 'false')
  })
})
