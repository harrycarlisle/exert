import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'

interface Props {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  onClose: () => void
  onLog: (note: string | null) => void | Promise<unknown>
  disabled?: boolean
}

type Mode = 'choices' | 'custom'

/**
 * Anchored vomit-detail callout. Falls back to a compact bottom sheet when the
 * popover would leave the viewport on narrow phones.
 */
export function VomitDetailPopover({
  open,
  anchorRef,
  onClose,
  onLog,
  disabled = false,
}: Props) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const firstButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<Mode>('choices')
  const [detail, setDetail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [placement, setPlacement] = useState<'anchored' | 'sheet'>('anchored')
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 280 })

  useEffect(() => {
    if (!open) {
      setMode('choices')
      setDetail('')
      setError(null)
      setSaving(false)
      return
    }
    const focusTimer = window.setTimeout(() => {
      firstButtonRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(focusTimer)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const anchor = anchorRef.current
      const panel = panelRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight
      const panelWidth = Math.min(300, viewportWidth - 24)
      const estimatedHeight = panel?.offsetHeight || 220
      const spaceBelow = viewportHeight - rect.bottom - 12
      const useSheet = viewportWidth < 360 || spaceBelow < estimatedHeight + 8

      if (useSheet) {
        setPlacement('sheet')
        return
      }

      let left = rect.left + rect.width / 2 - panelWidth / 2
      left = Math.max(12, Math.min(left, viewportWidth - panelWidth - 12))
      const top = Math.min(
        rect.bottom + 8,
        viewportHeight - estimatedHeight - 12,
      )
      setPlacement('anchored')
      setCoords({ top, left, width: panelWidth })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef, mode])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (
        panelRef.current?.contains(target) ||
        anchorRef.current?.contains(target)
      ) {
        return
      }
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, onClose, anchorRef])

  useEffect(() => {
    if (open && mode === 'custom') {
      inputRef.current?.focus()
    }
  }, [open, mode])

  if (!open) return null

  async function commit(note: string | null) {
    if (saving || disabled) return
    setSaving(true)
    setError(null)
    try {
      await onLog(note)
    } finally {
      setSaving(false)
    }
  }

  async function commitCustom() {
    const trimmed = detail.trim()
    if (!trimmed) {
      setError('Enter a short detail, or choose No detail.')
      return
    }
    await commit(trimmed)
  }

  return (
    <div
      className={`vomit-popover-layer${placement === 'sheet' ? ' sheet' : ''}`}
      data-testid="vomit-detail-popover"
    >
      {placement === 'sheet' ? (
        <button
          type="button"
          className="vomit-popover-backdrop"
          aria-label="Dismiss vomit details"
          onClick={onClose}
        />
      ) : null}
      <div
        ref={panelRef}
        className={`vomit-popover${placement === 'sheet' ? ' sheet' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={
          placement === 'anchored'
            ? {
                top: coords.top,
                left: coords.left,
                width: coords.width,
              }
            : undefined
        }
      >
        <h2 id={titleId} className="vomit-popover-title">
          Vomit details
        </h2>
        {mode === 'choices' ? (
          <div className="vomit-popover-actions">
            <button
              ref={firstButtonRef}
              type="button"
              className="btn btn-secondary"
              disabled={disabled || saving}
              onClick={() => void commit(null)}
            >
              No detail
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={disabled || saving}
              onClick={() => void commit('Grass')}
            >
              Grass
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={disabled || saving}
              onClick={() => {
                setError(null)
                setMode('custom')
              }}
            >
              + Add detail
            </button>
          </div>
        ) : (
          <div className="vomit-popover-custom">
            <label className="form-field">
              <span className="sr-only">Vomit detail</span>
              <input
                ref={inputRef}
                value={detail}
                onChange={(event) => {
                  setDetail(event.target.value)
                  setError(null)
                }}
                placeholder="What did you notice?"
                autoComplete="off"
                disabled={disabled || saving}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    void commitCustom()
                  }
                }}
              />
            </label>
            {error ? <p className="field-error">{error}</p> : null}
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => {
                  setMode('choices')
                  setError(null)
                }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={disabled || saving}
                onClick={() => void commitCustom()}
              >
                Log vomit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
