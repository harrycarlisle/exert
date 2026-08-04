import { EVENT_META, type BathroomEvent } from '../models/types'
import { formatDate, formatTime, isSameLocalDay, parseISO } from '../lib/dates'
import { EventGlyph, NoteIcon } from './Icons'

interface Props {
  event: BathroomEvent
  onEdit?: (event: BathroomEvent) => void
  onDelete?: (event: BathroomEvent) => void
}

export function EventRow({ event, onEdit, onDelete }: Props) {
  const date = parseISO(event.timestamp)
  const time = formatTime(date)
  const when = isSameLocalDay(date, new Date())
    ? time
    : `${formatDate(date, undefined, 'medium')} · ${time}`
  const label = EVENT_META[event.type].label

  return (
    <li className="event-row">
      <span className={`event-icon ${event.type}`} aria-hidden="true">
        <EventGlyph type={event.type} className="glyph" />
      </span>
      <div className="event-main">
        <strong>{label}</strong>
        <span>
          {when}
          {event.note ? (
            <>
              {' '}
              <NoteIcon />
              <span className="sr-only">Has note</span>
            </>
          ) : null}
        </span>
        {event.note ? <span className="event-note">{event.note}</span> : null}
      </div>
      <div className="event-actions">
        {onEdit ? (
          <button
            type="button"
            className="text-btn"
            onClick={() => onEdit(event)}
            aria-label={`Edit ${label} at ${when}`}
          >
            Edit
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            className="text-btn"
            onClick={() => onDelete(event)}
            aria-label={`Delete ${label} at ${when}`}
          >
            Delete
          </button>
        ) : null}
      </div>
    </li>
  )
}
