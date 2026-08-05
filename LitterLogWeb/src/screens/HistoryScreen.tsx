import { useMemo, useState } from 'react'
import { EventRow } from '../components/EventRow'
import {
  formatDate,
  historyGroupKey,
  historyGroupTitle,
  parseISO,
} from '../lib/dates'
import { csvFilename, eventsToCsv } from '../lib/csv'
import { resolveAnimalName } from '../lib/animals'
import { shareOrDownloadFile } from '../lib/share'
import type { LitterLogState } from '../state/useLitterLog'
import type { BathroomEvent, BathroomEventType } from '../models/types'

type TypeFilter = 'all' | BathroomEventType

interface Props {
  state: LitterLogState
  onDeleteRequest: (event: BathroomEvent) => void
}

export function HistoryScreen({ state, onDeleteRequest }: Props) {
  const {
    events,
    animals,
    setScreen,
    setEditorMode,
    setEditorEvent,
    setStatus,
  } = state
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [animalFilter, setAnimalFilter] = useState<string>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const animalFilters = useMemo(() => {
    const idsWithHistory = new Set(events.map((event) => event.animalId))
    return animals
      .filter(
        (animal) =>
          !animal.archived || idsWithHistory.has(animal.id) || animal.isSystem,
      )
      .sort((a, b) => {
        if (a.archived !== b.archived) return a.archived ? 1 : -1
        const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER
        const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER
        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
  }, [animals, events])

  const filtered = useMemo(() => {
    return events.filter((event) => {
      if (typeFilter !== 'all' && event.type !== typeFilter) return false
      if (animalFilter !== 'all' && event.animalId !== animalFilter)
        return false
      const date = parseISO(event.timestamp)
      if (startDate) {
        const start = new Date(`${startDate}T00:00:00`)
        if (date < start) return false
      }
      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999`)
        if (date > end) return false
      }
      return true
    })
  }, [events, typeFilter, animalFilter, startDate, endDate])

  const groups = useMemo(() => {
    const map = new Map<string, BathroomEvent[]>()
    const order: string[] = []
    for (const event of filtered) {
      const date = parseISO(event.timestamp)
      const key = historyGroupKey(date)
      if (!map.has(key)) {
        map.set(key, [])
        order.push(key)
      }
      map.get(key)!.push(event)
    }
    return order.map((key) => {
      const items = map.get(key)!
      const sample = parseISO(items[0].timestamp)
      return {
        key,
        title: historyGroupTitle(key as never, sample),
        events: items,
      }
    })
  }, [filtered])

  const filtersActive =
    typeFilter !== 'all' ||
    animalFilter !== 'all' ||
    Boolean(startDate) ||
    Boolean(endDate)

  async function exportCsv() {
    try {
      const csv = eventsToCsv(filtered, animals)
      const file = new File([csv], csvFilename(), {
        type: 'text/csv;charset=utf-8',
      })
      const result = await shareOrDownloadFile(file)
      setStatus({
        kind: 'success',
        message:
          result === 'shared' ? 'CSV ready to share' : 'CSV download started',
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setStatus({ kind: 'error', message: 'Could not export CSV.' })
    }
  }

  return (
    <section>
      <header className="topbar">
        <div>
          <h1>History</h1>
          <p className="subtitle">
            {events.length === 0
              ? 'No records yet'
              : animalFilter === 'all'
                ? `${events.length} total · showing ${filtered.length}`
                : `${resolveAnimalName(animals, animalFilter)} · showing ${filtered.length}`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setScreen('home')}
        >
          Back
        </button>
      </header>

      <div className="chip-row" role="group" aria-label="Animal filter">
        <button
          type="button"
          className="chip"
          aria-pressed={animalFilter === 'all'}
          onClick={() => setAnimalFilter('all')}
        >
          All animals
        </button>
        {animalFilters.map((animal) => (
          <button
            key={animal.id}
            type="button"
            className="chip"
            aria-pressed={animalFilter === animal.id}
            onClick={() => setAnimalFilter(animal.id)}
          >
            {animal.name}
            {animal.archived ? ' (archived)' : ''}
          </button>
        ))}
      </div>

      <div className="chip-row" role="group" aria-label="Event type filter">
        {(
          [
            ['all', 'All'],
            ['pee', 'Pee'],
            ['poo', 'Poo'],
            ['triedToPee', 'Tried'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="chip"
            aria-pressed={typeFilter === value}
            onClick={() => setTypeFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="filters-panel card">
        <label>
          Start date
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label>
          End date
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </label>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setTypeFilter('all')
              setAnimalFilter('all')
              setStartDate('')
              setEndDate('')
            }}
          >
            Clear filters
          </button>
          <button type="button" className="btn btn-primary" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      {filtersActive ? (
        <p className="filter-active">
          Filters are active — your full history is still saved.
        </p>
      ) : null}

      <div className="btn-row" style={{ marginBottom: 14 }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setEditorEvent(null)
            setEditorMode('add')
          }}
        >
          Add Entry
        </button>
      </div>

      {events.length === 0 ? (
        <div className="card empty">
          No history yet. Logged events will appear here for you and your
          veterinarian.
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty">
          Nothing matches the current filters. Your history is still saved — try
          All animals or a wider date range.
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="history-group">
            <h3>{group.title}</h3>
            <div className="card">
              <ul className="event-list">
                {group.events.map((event) => (
                  <EventRow
                    key={event.id}
                    event={event}
                    animalName={resolveAnimalName(animals, event.animalId)}
                    onEdit={(item) => {
                      setEditorEvent(item)
                      setEditorMode('edit')
                    }}
                    onDelete={onDeleteRequest}
                  />
                ))}
              </ul>
            </div>
            {group.key.startsWith('day:') ? (
              <p className="sr-only">
                Group date {formatDate(parseISO(group.events[0].timestamp))}
              </p>
            ) : null}
          </div>
        ))
      )}
    </section>
  )
}
