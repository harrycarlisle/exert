export function DropletIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2.2c.5.8 7 10.2 7 14.1A7 7 0 1 1 5 16.3C5 12.4 11.5 3 12 2.2z"
      />
    </svg>
  )
}

/** Simple non-emoji symbol for Poo — rounded mound, not a blank circle. */
export function PooIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 4.2c1.4 0 2.4 1.2 2.2 2.5-.1.6.2 1.1.7 1.4 1.3.7 2.1 2.1 2.1 3.6 0 .4-.1.9-.2 1.3 1.2.6 2 1.8 2 3.2 0 2.1-1.9 3.6-4.3 3.6H9.5C7.1 19.8 5.2 18.3 5.2 16.2c0-1.4.8-2.6 2-3.2-.1-.4-.2-.9-.2-1.3 0-1.5.8-2.9 2.1-3.6.5-.3.8-.8.7-1.4C9.6 5.4 10.6 4.2 12 4.2z"
      />
    </svg>
  )
}

export function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3.2 1.8 20.5h20.4L12 3.2zm0 5.3c.6 0 1 .5.9 1.1l-.5 5.2h-.8l-.5-5.2c0-.6.4-1.1.9-1.1zM12 18a1.2 1.2 0 1 0 0-2.4A1.2 1.2 0 0 0 12 18z"
      />
    </svg>
  )
}

export function HistoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 4a8 8 0 1 1-7.2 4.5l1.7.9A6 6 0 1 0 12 6V4zm-.8 3.2h1.6v5.1l3.5 2.1-.8 1.3-4.3-2.6V7.2zM5.2 7.1l2.6 1.1L6.3 5l2-.9-4.5-1.1L2.7 7.5l2.5-.4z"
      />
    </svg>
  )
}

export function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.1 12.9c0-.3 0-.6-.1-.9l2-1.6-1.9-3.3-2.4 1a6.8 6.8 0 0 0-1.6-.9l-.4-2.6H9.3l-.4 2.6c-.6.2-1.1.5-1.6.9l-2.4-1-1.9 3.3 2 1.6c0 .3-.1.6-.1.9s0 .6.1.9l-2 1.6 1.9 3.3 2.4-1c.5.4 1 .7 1.6.9l.4 2.6h5.4l.4-2.6c.6-.2 1.1-.5 1.6-.9l2.4 1 1.9-3.3-2-1.6c.1-.3.1-.6.1-.9zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"
      />
    </svg>
  )
}

export function NoteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 3h9l5 5v13H6V3zm8 1.5V9h4.5L14 4.5zM8 12h8v1.5H8V12zm0 3.5h8V17H8v-1.5z"
      />
    </svg>
  )
}

export function MoreIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="19" r="1.8" fill="currentColor" />
    </svg>
  )
}

export function ChevronIcon({
  direction = 'down',
  className,
}: {
  direction?: 'down' | 'up' | 'right'
  className?: string
}) {
  const rotation =
    direction === 'up' ? '180' : direction === 'right' ? '-90' : '0'
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <path
        fill="currentColor"
        d="M6.7 9.3a1 1 0 0 1 1.4 0L12 13.2l3.9-3.9a1 1 0 1 1 1.4 1.4l-4.6 4.6a1 1 0 0 1-1.4 0L6.7 10.7a1 1 0 0 1 0-1.4z"
      />
    </svg>
  )
}

/** Soft splash mark for vomit — not a medical diagram. */
export function VomitIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.2 6.4c1.1-1.8 2.8-3 4.8-3s3.7 1.2 4.8 3c.5.8.1 1.9-.8 2.2-.7.2-1.4-.1-1.7-.7-.5-.9-1.3-1.5-2.3-1.5s-1.8.6-2.3 1.5c-.3.6-1 .9-1.7.7-.9-.3-1.3-1.4-.8-2.2zM5.4 12.2c1.6-1.2 3.5-1.9 5.6-1.9h2c2.1 0 4 .7 5.6 1.9 1 .8.7 2.4-.5 2.8l-1.5.5c-1.1.4-2.3.6-3.6.6h-2c-1.3 0-2.5-.2-3.6-.6l-1.5-.5c-1.2-.4-1.5-2-.5-2.8zM8 17.8c.9-.4 2-.6 3.2-.6h1.6c1.2 0 2.3.2 3.2.6.9.4 1 1.6.2 2.2-.9.7-2.1 1.1-3.4 1.1h-1.6c-1.3 0-2.5-.4-3.4-1.1-.8-.6-.7-1.8.2-2.2z"
      />
    </svg>
  )
}

/** Compact oval for hairball. */
export function HairballIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 4.5c3.8 0 6.8 2.6 6.8 6.2 0 2.1-1 4-2.6 5.2.7.5 1.2 1.3 1.2 2.2 0 1.5-1.5 2.6-3.4 2.6H9.9c-1.9 0-3.4-1.1-3.4-2.6 0-.9.5-1.7 1.2-2.2C6.2 14.7 5.2 12.8 5.2 10.7 5.2 7.1 8.2 4.5 12 4.5zm-2.4 4.2c-.5.7-.3 1.6.4 2 .7.5 1.6.3 2-.4.5-.7.3-1.6-.4-2-.7-.5-1.6-.3-2 .4zm4.5.2c-.6.4-.7 1.3-.2 1.9.4.6 1.3.7 1.9.2.6-.4.7-1.3.2-1.9-.4-.6-1.3-.7-1.9-.2z"
      />
    </svg>
  )
}

export function EventGlyph({
  type,
  className,
}: {
  type: 'pee' | 'poo' | 'vomit' | 'hairball' | 'triedToPee'
  className?: string
}) {
  if (type === 'pee') return <DropletIcon className={className} />
  if (type === 'poo') return <PooIcon className={className} />
  if (type === 'vomit') return <VomitIcon className={className} />
  if (type === 'hairball') return <HairballIcon className={className} />
  return <WarningIcon className={className} />
}
