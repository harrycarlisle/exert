import { EVENT_META, type BathroomEventType } from '../models/types'
import { EventGlyph } from './Icons'

interface Props {
  type: BathroomEventType
  onLog: (type: BathroomEventType) => void
  compact?: boolean
}

export function LogButton({ type, onLog, compact = false }: Props) {
  const meta = EVENT_META[type]
  const className = [
    'log-btn',
    type === 'triedToPee' ? 'tried' : type,
    compact ? 'tried' : '',
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
    >
      <EventGlyph type={type} className="glyph" />
      <span>{meta.label}</span>
    </button>
  )
}
