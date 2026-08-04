export function toISO(date: Date = new Date()): string {
  return date.toISOString()
}

export function parseISO(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`)
  }
  return date
}

export function startOfDay(date: Date, timeZone?: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = Number(parts.find((p) => p.type === 'year')?.value)
  const month = Number(parts.find((p) => p.type === 'month')?.value)
  const day = Number(parts.find((p) => p.type === 'day')?.value)
  // Construct local calendar day in the runtime's local zone for UI grouping.
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isYesterday(date: Date, now = new Date()): boolean {
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  return isSameLocalDay(date, yesterday)
}

export function formatTime(date: Date, locale = navigator.language): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatDate(
  date: Date,
  locale = navigator.language,
  style: Intl.DateTimeFormatOptions['dateStyle'] = 'medium',
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: style }).format(date)
}

export function formatFullDate(
  date: Date,
  locale = navigator.language,
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(date)
}

export function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string): Date {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date/time')
  }
  return date
}

export type HistoryGroupKey = 'today' | 'yesterday' | `day:${string}`

export function historyGroupKey(date: Date, now = new Date()): HistoryGroupKey {
  if (isSameLocalDay(date, now)) return 'today'
  if (isYesterday(date, now)) return 'yesterday'
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `day:${y}-${m}-${d}`
}

export function historyGroupTitle(key: HistoryGroupKey, date: Date): string {
  if (key === 'today') return 'Today'
  if (key === 'yesterday') return 'Yesterday'
  return formatFullDate(date)
}
