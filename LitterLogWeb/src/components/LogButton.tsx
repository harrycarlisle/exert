import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { EVENT_META, type BathroomEventType } from '../models/types'
import { EventGlyph } from './Icons'

interface Props extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'onClick'
> {
  type: BathroomEventType
  onLog?: (type: BathroomEventType) => void
  onClick?: () => void
  compact?: boolean
}

export const LogButton = forwardRef<HTMLButtonElement, Props>(
  function LogButton(
    {
      type,
      onLog,
      onClick,
      compact = false,
      disabled = false,
      className: extraClassName,
      ...rest
    },
    ref,
  ) {
    const meta = EVENT_META[type]
    const className = [
      'log-btn',
      type === 'triedToPee' ? 'tried' : type,
      compact ? 'tried wide' : '',
      disabled ? 'disabled' : '',
      extraClassName,
    ]
      .filter(Boolean)
      .join(' ')

    return (
      <button
        ref={ref}
        type="button"
        className={className}
        onClick={() => {
          if (onClick) {
            onClick()
            return
          }
          onLog?.(type)
        }}
        aria-label={meta.label}
        title={meta.description}
        disabled={disabled}
        {...rest}
      >
        <EventGlyph type={type} className="glyph" />
        <span className="log-btn-label">{meta.label}</span>
      </button>
    )
  },
)
