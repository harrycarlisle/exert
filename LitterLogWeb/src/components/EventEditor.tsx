import { useState } from 'react'
import {
  CURRENT_EVENT_SCHEMA,
  EVENT_META,
  type BathroomEvent,
  type BathroomEventType,
} from '../models/types'
import {
  fromDatetimeLocalValue,
  toDatetimeLocalValue,
  toISO,
} from '../lib/dates'
import { Dialog } from './Dialog'

interface Props {
  mode: 'add' | 'edit'
  initial?: BathroomEvent | null
  onCancel: () => void
  onSave: (event: BathroomEvent, isNew: boolean) => void
}

export function EventEditor({ mode, initial, onCancel, onSave }: Props) {
  const [type, setType] = useState<BathroomEventType>(initial?.type ?? 'pee')
  const [when, setWhen] = useState(
    toDatetimeLocalValue(initial ? new Date(initial.timestamp) : new Date()),
  )
  const [note, setNote] = useState(initial?.note ?? '')

  function handleSave() {
    const timestamp = fromDatetimeLocalValue(when)
    const now = new Date()
    const event: BathroomEvent = {
      id:
        initial?.id ??
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `evt_${Date.now()}`),
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
          <span>Event type</span>
          <select
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
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          Save
        </button>
      </div>
    </Dialog>
  )
}
