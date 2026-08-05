import { useEffect, useId, useRef, useState } from 'react'
import { EVENT_META, type BathroomEvent } from '../models/types'
import { formatDate, formatTime, isSameLocalDay, parseISO } from '../lib/dates'
import { EventGlyph, MoreIcon, NoteIcon } from './Icons'

interface Props {
  event: BathroomEvent
  animalName?: string
  onEdit?: (event: BathroomEvent) => void
  onDelete?: (event: BathroomEvent) => void
}

const CLOSE_MENUS_EVENT = 'litter-log:close-event-menus'

export function EventRow({ event, animalName, onEdit, onDelete }: Props) {
  const date = parseISO(event.timestamp)
  const time = formatTime(date)
  const when = isSameLocalDay(date, new Date())
    ? time
    : `${formatDate(date, undefined, 'medium')} · ${time}`
  const label = EVENT_META[event.type].label
  const hasActions = Boolean(onEdit || onDelete)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const firstItemRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) return

    const onPointerDown = (nativeEvent: PointerEvent) => {
      const target = nativeEvent.target as Node | null
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      setMenuOpen(false)
    }
    const onKeyDown = (nativeEvent: KeyboardEvent) => {
      if (nativeEvent.key === 'Escape') {
        nativeEvent.preventDefault()
        setMenuOpen(false)
        triggerRef.current?.focus()
      }
    }
    const onCloseOthers = () => setMenuOpen(false)

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener(CLOSE_MENUS_EVENT, onCloseOthers)
    const focusTimer = window.setTimeout(() => {
      firstItemRef.current?.focus()
    }, 0)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(CLOSE_MENUS_EVENT, onCloseOthers)
      window.clearTimeout(focusTimer)
    }
  }, [menuOpen])

  function openMenu() {
    window.dispatchEvent(new Event(CLOSE_MENUS_EVENT))
    setMenuOpen(true)
  }

  const actionsLabel = `Actions for ${label} logged at ${time}`

  return (
    <li className="event-row">
      <span className={`event-icon ${event.type}`} aria-hidden="true">
        <EventGlyph type={event.type} className="glyph" />
      </span>
      <div className="event-main">
        <strong>{label}</strong>
        <span>
          {when}
          {animalName ? ` · ${animalName}` : ''}
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
      {hasActions ? (
        <div className="event-actions">
          <button
            ref={triggerRef}
            type="button"
            className="icon-btn event-menu-trigger"
            aria-label={actionsLabel}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            onClick={() => {
              if (menuOpen) {
                setMenuOpen(false)
              } else {
                openMenu()
              }
            }}
          >
            <MoreIcon />
          </button>
          {menuOpen ? (
            <div
              ref={menuRef}
              id={menuId}
              className="event-menu"
              role="menu"
              aria-label={actionsLabel}
            >
              {onEdit ? (
                <button
                  ref={firstItemRef}
                  type="button"
                  className="event-menu-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onEdit(event)
                  }}
                >
                  Edit
                </button>
              ) : null}
              {onDelete ? (
                <button
                  ref={onEdit ? undefined : firstItemRef}
                  type="button"
                  className="event-menu-item danger"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    onDelete(event)
                  }}
                >
                  Delete
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
