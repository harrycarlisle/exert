import { EVENT_META, type BathroomEventType } from '../models/types'
import { EventGlyph } from './Icons'

interface Props {
  type: BathroomEventType
  onLog: (type: BathroomEventType) => void
  compact?: boolean
  disabled?: boolean
}

export function LogButton({
  type,
  onLog,
  compact = false,
  disabled = false,
}: Props) {
  const meta = EVENT_META[type]
  const className = [
    'log-btn',
    type === 'triedToPee' ? 'tried' : type,
    compact ? 'tried wide' : '',
    disabled ? 'disabled' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={className}
      onClick={() => onLog(type)}
      aria-label={meta.label}
      title={meta.description}
      disabled={disabled}
    >
      <EventGlyph type={type} className="glyph" />
      <span className="log-btn-label">{meta.label}</span>
    </button>
  )
}
