import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { contrastRatio } from './lib/contrast'
import { eventsToCsv } from './lib/csv'
import { createBackup, parseBackup } from './lib/backup'
import { createSeedAnimals } from './lib/animals'
import { DEFAULT_SETTINGS, type BathroomEvent } from './models/types'
import {
  deleteDatabaseForTests,
  fetchEvents,
  setIndexedDBFactory,
} from './db/database'
import { clearLocalStorageBackendForTests } from './db/localStorageBackend'
import {
  initializeStorage,
  putEvent,
  resetAdapterForTests,
} from './db/storageAdapter'
import { loggedMessage } from './state/useLitterLog'

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

describe('Vomit and Hairball logging', () => {
  beforeEach(async () => {
    resetAdapterForTests()
    clearLocalStorageBackendForTests()
    setIndexedDBFactory(null)
    await deleteDatabaseForTests()
    sessionStorage.clear()
  })

  it('shows four main logging controls and keeps Tried to Pee collapsed', async () => {
    await readyHome()
    expect(screen.getByTestId('main-logging-grid')).toBeVisible()
    expect(screen.getByRole('button', { name: /^Pee$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Poo$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Vomit$/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /^Hairball$/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: /^Tried to Pee$/ })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'More logging options' }),
    ).toHaveAttribute('aria-expanded', 'false')
  })

  it('logs Hairball immediately and updates Today / Recent', async () => {
    await readyHome()
    await userEvent.click(screen.getByRole('button', { name: /^Hairball$/ }))
    expect(await screen.findByTestId('status-toast')).toHaveTextContent(
      'Hairball logged for Cleo',
    )
    expect(screen.getByTestId('today-stats')).toHaveTextContent('1 Hairball')
    expect(screen.getByRole('heading', { name: 'Recent' })).toBeVisible()
    expect(document.querySelector('.event-row strong')?.textContent).toBe(
      'Hairball',
    )
  })

  it('opens Vomit details without saving, then logs No detail and Grass', async () => {
    await readyHome()
    await userEvent.click(screen.getByRole('button', { name: /^Vomit$/ }))
    const popover = await screen.findByTestId('vomit-detail-popover')
    expect(
      within(popover).getByRole('heading', { name: 'Vomit details' }),
    ).toBeVisible()
    expect(screen.queryByTestId('status-toast')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Recent' })).toBeNull()

    await userEvent.click(
      within(popover).getByRole('button', { name: 'No detail' }),
    )
    expect(await screen.findByTestId('status-toast')).toHaveTextContent(
      'Vomit logged for Cleo',
    )
    expect(screen.getByTestId('today-stats')).toHaveTextContent('1 Vomit')

    // Tap debounce blocks rapid same-type logs; wait past the window.
    await new Promise((resolve) => window.setTimeout(resolve, 400))
    await userEvent.click(screen.getByRole('button', { name: /^Vomit$/ }))
    const again = await screen.findByTestId('vomit-detail-popover')
    await userEvent.click(within(again).getByRole('button', { name: 'Grass' }))
    await waitFor(() => {
      expect(screen.getByTestId('status-toast')).toHaveTextContent(
        'Vomit logged for Cleo · Grass',
      )
    })
    expect(screen.getByTestId('today-stats')).toHaveTextContent('2 Vomits')
    expect(screen.getByText('Grass')).toBeVisible()
  })

  it('saves custom vomit detail on Enter and rejects empty custom detail', async () => {
    await readyHome()
    await userEvent.click(screen.getByRole('button', { name: /^Vomit$/ }))
    const popover = await screen.findByTestId('vomit-detail-popover')
    await userEvent.click(
      within(popover).getByRole('button', { name: '+ Add detail' }),
    )
    const input = within(popover).getByPlaceholderText('What did you notice?')
    await userEvent.click(
      within(popover).getByRole('button', { name: 'Log vomit' }),
    )
    expect(within(popover).getByText(/Enter a short detail/i)).toBeVisible()
    expect(screen.queryByTestId('status-toast')).toBeNull()

    await userEvent.type(input, '  foamy  ')
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByTestId('status-toast')).toHaveTextContent(
      'Vomit logged for Cleo · foamy',
    )
    expect(screen.getByText('foamy')).toBeVisible()
  })

  it('dismisses the vomit popover without creating an event', async () => {
    await readyHome()
    await userEvent.click(screen.getByRole('button', { name: /^Vomit$/ }))
    expect(await screen.findByTestId('vomit-detail-popover')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByTestId('vomit-detail-popover')).toBeNull()
    })
    expect(screen.queryByRole('heading', { name: 'Recent' })).toBeNull()
    expect(screen.getByTestId('today-stats')).toHaveTextContent('0 Vomits')
  })

  it('does not show a success toast when Hairball persistence fails', async () => {
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
      blocking = true
      await userEvent.click(screen.getByRole('button', { name: /^Hairball$/ }))
      await waitFor(() => {
        expect(screen.getByTestId('status-toast')).toHaveTextContent(
          /couldn’t access storage|couldn’t save|storage/i,
        )
      })
      expect(screen.getByTestId('status-toast')).not.toHaveTextContent(
        /Hairball logged/i,
      )
      expect(screen.queryByRole('heading', { name: 'Recent' })).toBeNull()
    } finally {
      Storage.prototype.setItem = original
    }
  })

  it('supports edit, delete, and undo for the new types', async () => {
    await readyHome()
    await userEvent.click(screen.getByRole('button', { name: /^Hairball$/ }))
    await screen.findByTestId('status-toast')
    await userEvent.click(
      screen.getByRole('button', { name: /Actions for Hairball logged at/i }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }))
    const editor = screen.getByRole('dialog', { name: 'Edit Entry' })
    await userEvent.selectOptions(
      within(editor).getByRole('combobox', { name: 'Event type' }),
      'vomit',
    )
    await userEvent.clear(within(editor).getByLabelText(/Note/i))
    await userEvent.type(within(editor).getByLabelText(/Note/i), 'edited')
    await userEvent.click(within(editor).getByRole('button', { name: 'Save' }))
    expect(await screen.findByTestId('status-toast')).toHaveTextContent(
      'Entry updated',
    )
    expect(document.querySelector('.event-row strong')?.textContent).toBe(
      'Vomit',
    )
    expect(screen.getByText('edited')).toBeVisible()

    await userEvent.click(
      screen.getByRole('button', { name: /Actions for Vomit logged at/i }),
    )
    await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }))
    await userEvent.click(
      within(
        screen.getByRole('dialog', { name: 'Delete this entry?' }),
      ).getByRole('button', { name: 'Delete' }),
    )
    await waitFor(() => {
      expect(screen.getByTestId('today-stats')).toHaveTextContent('0 Vomits')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }))
    await waitFor(() => {
      expect(screen.getByTestId('today-stats')).toHaveTextContent('1 Vomit')
    })
  })

  it('exports and restores Vomit/Hairball through CSV and JSON', async () => {
    const animals = createSeedAnimals()
    const cleo = animals.find((animal) => animal.name === 'Cleo')!
    const events: BathroomEvent[] = [
      {
        id: 'v1',
        animalId: cleo.id,
        type: 'vomit',
        timestamp: '2026-08-06T10:00:00.000Z',
        createdAt: '2026-08-06T10:00:00.000Z',
        note: 'Grass',
        source: 'web-app',
        schemaVersion: 2,
      },
      {
        id: 'h1',
        animalId: cleo.id,
        type: 'hairball',
        timestamp: '2026-08-06T11:00:00.000Z',
        createdAt: '2026-08-06T11:00:00.000Z',
        note: null,
        source: 'web-app',
        schemaVersion: 2,
      },
    ]
    const csv = eventsToCsv(events, animals)
    expect(csv).toContain('Vomit')
    expect(csv).toContain('Hairball')
    expect(csv).toContain('Grass')

    const backup = createBackup(
      events,
      { ...DEFAULT_SETTINGS, selectedAnimalId: cleo.id },
      animals,
    )
    const parsed = parseBackup(backup)
    expect(parsed.events.map((event) => event.type).sort()).toEqual([
      'hairball',
      'vomit',
    ])
    expect(parsed.events.find((event) => event.type === 'vomit')?.note).toBe(
      'Grass',
    )
  })

  it('keeps IndexedDB and localStorage fallback support for the new types', async () => {
    await initializeStorage()
    const animals = await (await import('./db/storageAdapter')).fetchAnimals()
    const cleo = animals.find((animal) => animal.name === 'Cleo')!
    await putEvent({
      id: 'idb-vomit',
      animalId: cleo.id,
      type: 'vomit',
      timestamp: '2026-08-06T12:00:00.000Z',
      createdAt: '2026-08-06T12:00:00.000Z',
      note: 'Grass',
      source: 'web-app',
      schemaVersion: 2,
    })
    expect(
      (await fetchEvents()).some((event) => event.id === 'idb-vomit'),
    ).toBe(true)

    resetAdapterForTests()
    clearLocalStorageBackendForTests()
    setIndexedDBFactory({
      open() {
        throw new DOMException('idb down', 'UnknownError')
      },
    } as unknown as IDBFactory)
    await initializeStorage()
    const fallbackAnimals = await (
      await import('./db/storageAdapter')
    ).fetchAnimals()
    const fallbackCleo = fallbackAnimals.find(
      (animal) => animal.name === 'Cleo',
    )!
    await putEvent({
      id: 'ls-hairball',
      animalId: fallbackCleo.id,
      type: 'hairball',
      timestamp: '2026-08-06T13:00:00.000Z',
      createdAt: '2026-08-06T13:00:00.000Z',
      note: null,
      source: 'web-app',
      schemaVersion: 2,
    })
    const events = await (await import('./db/storageAdapter')).fetchEvents()
    expect(events.some((event) => event.id === 'ls-hairball')).toBe(true)
  })

  it('uses accessible toast copy and AA contrast colors', () => {
    expect(loggedMessage('hairball', 'Bower')).toBe('Hairball logged for Bower')
    expect(loggedMessage('vomit', 'Cleo')).toBe('Vomit logged for Cleo')
    expect(loggedMessage('vomit', 'Cleo', 'Grass')).toBe(
      'Vomit logged for Cleo · Grass',
    )
    expect(contrastRatio('#ffffff', '#3f6b3c')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#2a1a08', '#c4894a')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#ffffff', '#4f7f4b')).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio('#2a1a08', '#d09555')).toBeGreaterThanOrEqual(4.5)
  })
})
