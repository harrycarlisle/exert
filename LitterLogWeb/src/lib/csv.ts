import type { BathroomEvent } from '../models/types'
import { EVENT_META } from '../models/types'
import { formatDate, formatTime, parseISO } from './dates'

export function escapeCsvField(field: string): string {
  const needsQuoting = /[",\n\r]/.test(field)
  if (!needsQuoting) return field
  return `"${field.replace(/"/g, '""')}"`
}

export function eventsToCsv(events: BathroomEvent[]): string {
  const header = [
    'Date',
    'Time',
    'ISO 8601 Timestamp',
    'Event Type',
    'Note',
    'Recorded From',
  ]
  const sorted = [...events].sort(
    (a, b) => parseISO(a.timestamp).getTime() - parseISO(b.timestamp).getTime(),
  )
  const lines = [header.map(escapeCsvField).join(',')]
  for (const event of sorted) {
    const date = parseISO(event.timestamp)
    lines.push(
      [
        formatDate(date, undefined, 'short'),
        formatTime(date),
        event.timestamp,
        EVENT_META[event.type].label,
        event.note ?? '',
        'Web App',
      ]
        .map(escapeCsvField)
        .join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export function csvFilename(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `Litter-Log-${y}-${m}-${d}.csv`
}
