import { useState } from 'react'
import {
  CURRENT_EVENT_SCHEMA,
  EVENT_META,
  type Animal,
  type BathroomEvent,
  type BathroomEventType,
} from '../models/types'
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  toISO,
} from '../lib/dates'
import { activeAnimals } from '../lib/animals'
import { Dialog } from './Dialog'

interface Props {
  mode: 'add' | 'edit'
  initial?: BathroomEvent | null
  animals: Animal[]
  defaultAnimalId: string | null
  onCancel: () => void
  onSave: (event: BathroomEvent, isNew: boolean) => void
}

export function EventEditor({
  mode,
  initial,
  animals,
  defaultAnimalId,
  onCancel,
  onSave,
}: Props) {
  const choosable = (() => {
    const active = activeAnimals(animals)
    if (
      initial?.animalId &&
      !active.some((animal) => animal.id === initial.animalId)
    ) {
      const current = animals.find((animal) => animal.id === initial.animalId)
      return current ? [...active, current] : active
    }
    return active
  })()

  const [type, setType] = useState<BathroomEventType>(initial?.type ?? 'pee')
  const [animalId, setAnimalId] = useState(
    initial?.animalId ?? defaultAnimalId ?? choosable[0]?.id ?? '',
  )
  const [when, setWhen] = useState(
    toDatetimeLocalValue(initial ? new Date(initial.timestamp) : new Date()),
  )
  const [note, setNote] = useState(initial?.note ?? '')

  function handleSave() {
    if (!animalId) return
    const timestamp = fromDatetimeLocalValue(when)
    const now = new Date()
    const event: BathroomEvent = {
      id:
        initial?.id ??
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `evt_${Date.now()}`),
      animalId,
      type,
      timestamp: toISO(timestamp),
      createdAt: initial?.createdAt ?? toISO(now),
      note: note.trim() ? note.trim() : null,
      source: 'web-app',
      schemaVersion: CURRENT_EVENT_SCHEMA,
    }
    onSave(event, mode === 'add')
  }

  return (
    <Dialog
      title={mode === 'add' ? 'Add Entry' : 'Edit Entry'}
      onClose={onCancel}
    >
      <div className="form-field">
        <label>
          <span>Animal</span>
          <select
            aria-label="Event animal"
            value={animalId}
            onChange={(e) => setAnimalId(e.target.value)}
          >
            {choosable.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.name}
                {animal.archived ? ' (archived)' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-field">
        <label>
          <span>Event type</span>
          <select
            aria-label="Event type"
            value={type}
            onChange={(e) => setType(e.target.value as BathroomEventType)}
          >
            {(Object.keys(EVENT_META) as BathroomEventType[]).map((key) => (
              <option key={key} value={key}>
                {EVENT_META[key].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="form-field">
        <label>
          <span>Date and time</span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </label>
      </div>
      <div className="form-field">
        <label>
          <span>Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            placeholder="Optional note for your veterinarian"
          />
        </label>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={!animalId}
        >
          Save
        </button>
      </div>
    </Dialog>
  )
}
