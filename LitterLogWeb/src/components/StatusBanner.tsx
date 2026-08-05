import { useEffect, useRef } from 'react'
import type { StatusBanner as Banner } from '../state/useLitterLog'
import type { BathroomEventType } from '../models/types'

const SUCCESS_DISMISS_MS = 5000

interface Props {
  status: Banner
  onUndo: () => void
  onRetry: (type: BathroomEventType) => void
  onRetryLoad?: () => void
  onDismiss: () => void
}

/**
 * Floating toast overlay. Announcements are handled by the app-level live
 * region so the same result is not spoken twice.
 */
export function StatusBanner({
  status,
  onUndo,
  onRetry,
  onRetryLoad,
  onDismiss,
}: Props) {
  const pausedRef = useRef(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    pausedRef.current = false
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (status.kind !== 'success') return

    const schedule = () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => {
        if (pausedRef.current) {
          schedule()
          return
        }
        onDismiss()
      }, SUCCESS_DISMISS_MS)
    }
    schedule()
    return () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [status, onDismiss])

  function pauseDismiss() {
    pausedRef.current = true
  }

  function resumeDismiss() {
    pausedRef.current = false
  }

  return (
    <div className="toast-layer">
      <div
        className={`toast-floating ${status.kind === 'error' ? 'error' : 'success'}`}
        data-testid="status-toast"
      >
        <div className="toast-message">{status.message}</div>
        {status.kind === 'success' && status.undoId ? (
          <button
            type="button"
            className="toast-action"
            onPointerDown={pauseDismiss}
            onPointerUp={resumeDismiss}
            onPointerLeave={resumeDismiss}
            onFocus={pauseDismiss}
            onBlur={resumeDismiss}
            onClick={() => {
              pauseDismiss()
              onUndo()
            }}
          >
            Undo
          </button>
        ) : null}
        {status.kind === 'error' && status.retryType ? (
          <button
            type="button"
            className="toast-action"
            onClick={() => onRetry(status.retryType!)}
          >
            Try again
          </button>
        ) : null}
        {status.kind === 'error' && status.retryLoad && onRetryLoad ? (
          <button type="button" className="toast-action" onClick={onRetryLoad}>
            Try again
          </button>
        ) : null}
      </div>
    </div>
  )
}
