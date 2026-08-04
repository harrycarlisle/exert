import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteAllEvents,
  deleteDatabaseForTests,
  deleteEvent,
  fetchEvents,
  fetchSettings,
  putEvent,
  putManyEvents,
  saveSettings,
} from './database'
import { DEFAULT_SETTINGS, type BathroomEvent } from '../models/types'

function makeEvent(
  type: BathroomEvent['type'],
  timestamp: string,
  id: string = `evt_${Math.random().toString(16).slice(2)}`,
): BathroomEvent {
  return {
    id,
    type,
    timestamp,
    createdAt: timestamp,
    note: null,
    source: 'web-app',
    schemaVersion: 1,
  }
}

describe('IndexedDB store', () => {
  beforeEach(async () => {
    await deleteDatabaseForTests()
  })

  it('creates each event type and retrieves them', async () => {
    await putEvent(makeEvent('pee', '2026-08-04T10:00:00.000Z'))
    await putEvent(makeEvent('poo', '2026-08-04T11:00:00.000Z'))
    await putEvent(makeEvent('triedToPee', '2026-08-04T12:00:00.000Z'))
    const events = await fetchEvents()
    expect(events).toHaveLength(3)
    expect(new Set(events.map((e) => e.type))).toEqual(
      new Set(['pee', 'poo', 'triedToPee']),
    )
  })

  it('preserves multiple rapid inserts', async () => {
    const batch = Array.from({ length: 20 }, (_, i) =>
      makeEvent(
        i % 2 === 0 ? 'pee' : 'poo',
        new Date(Date.UTC(2026, 7, 4, 0, i)).toISOString(),
      ),
    )
    await putManyEvents(batch)
    expect(await fetchEvents()).toHaveLength(20)
  })

  it('edits and deletes events', async () => {
    const event = makeEvent('pee', '2026-08-04T10:00:00.000Z', 'edit-me')
    await putEvent(event)
    await putEvent({ ...event, type: 'triedToPee', note: 'straining' })
    let events = await fetchEvents()
    expect(events[0].type).toBe('triedToPee')
    expect(events[0].note).toBe('straining')
    await deleteEvent('edit-me')
    events = await fetchEvents()
    expect(events).toHaveLength(0)
  })

  it('persists settings', async () => {
    await saveSettings({
      ...DEFAULT_SETTINGS,
      catName: 'Mochi',
      hapticsEnabled: false,
      appearance: 'dark',
    })
    const settings = await fetchSettings()
    expect(settings.catName).toBe('Mochi')
    expect(settings.hapticsEnabled).toBe(false)
    expect(settings.appearance).toBe('dark')
  })

  it('handles empty database safely', async () => {
    expect(await fetchEvents()).toEqual([])
    expect(await fetchSettings()).toMatchObject(DEFAULT_SETTINGS)
    await deleteAllEvents()
    expect(await fetchEvents()).toEqual([])
  })
})
