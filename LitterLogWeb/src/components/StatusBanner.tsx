import type { StatusBanner as Banner } from '../state/useLitterLog'
import type { BathroomEventType } from '../models/types'

interface Props {
  status: Banner
  onUndo: () => void
  onRetry: (type: BathroomEventType) => void
  onRetryLoad?: () => void
  onDismiss: () => void
}

export function StatusBanner({
  status,
  onUndo,
  onRetry,
  onRetryLoad,
  onDismiss,
}: Props) {
  return (
    <div
      className={`banner ${status.kind === 'error' ? 'error' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="message">{status.message}</div>
      {status.kind === 'success' && status.undoId ? (
        <button type="button" className="text-btn" onClick={onUndo}>
          Undo
        </button>
      ) : null}
      {status.kind === 'error' && status.retryType ? (
        <button
          type="button"
          className="text-btn"
          onClick={() => onRetry(status.retryType!)}
        >
          Try again
        </button>
      ) : null}
      {status.kind === 'error' && status.retryLoad && onRetryLoad ? (
        <button type="button" className="text-btn" onClick={onRetryLoad}>
          Try again
        </button>
      ) : null}
      <button
        type="button"
        className="text-btn"
        onClick={onDismiss}
        aria-label="Dismiss status"
      >
        Close
      </button>
    </div>
  )
}
