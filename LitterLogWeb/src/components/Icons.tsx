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

export function CircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="currentColor" />
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

export function EventGlyph({
  type,
  className,
}: {
  type: 'pee' | 'poo' | 'triedToPee'
  className?: string
}) {
  if (type === 'pee') return <DropletIcon className={className} />
  if (type === 'poo') return <CircleIcon className={className} />
  return <WarningIcon className={className} />
}
