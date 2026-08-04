import {
  CURRENT_BACKUP_SCHEMA,
  CURRENT_EVENT_SCHEMA,
  CURRENT_SETTINGS_SCHEMA,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BathroomEvent,
  type BathroomEventType,
  type LitterLogBackup,
} from '../models/types'
import { toISO } from './dates'

const EVENT_TYPES: BathroomEventType[] = ['pee', 'poo', 'triedToPee']

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEvent(value: unknown): value is BathroomEvent {
  if (!isObject(value)) return false
  return (
    typeof value.id === 'string' &&
    EVENT_TYPES.includes(value.type as BathroomEventType) &&
    typeof value.timestamp === 'string' &&
    typeof value.createdAt === 'string' &&
    value.source === 'web-app' &&
    typeof value.schemaVersion === 'number' &&
    (value.note === undefined ||
      value.note === null ||
      typeof value.note === 'string')
  )
}

function isSettings(value: unknown): value is AppSettings {
  if (!isObject(value)) return false
  return (
    typeof value.catName === 'string' &&
    typeof value.vetPhoneNumber === 'string' &&
    typeof value.hapticsEnabled === 'boolean' &&
    ['system', 'light', 'dark'].includes(value.appearance as string) &&
    typeof value.schemaVersion === 'number'
  )
}

export function createBackup(
  events: BathroomEvent[],
  settings: AppSettings,
  createdAt = new Date(),
): LitterLogBackup {
  return {
    format: 'litter-log-backup',
    schemaVersion: CURRENT_BACKUP_SCHEMA,
    createdAt: toISO(createdAt),
    events,
    settings,
  }
}

export function parseBackup(raw: unknown): LitterLogBackup {
  if (!isObject(raw)) {
    throw new Error('Backup file is not a valid JSON object.')
  }
  if (raw.format !== 'litter-log-backup') {
    throw new Error('This file is not a Litter Log backup.')
  }
  if (
    typeof raw.schemaVersion !== 'number' ||
    raw.schemaVersion > CURRENT_BACKUP_SCHEMA
  ) {
    throw new Error(
      'Backup schema is unsupported by this version of Litter Log.',
    )
  }
  if (typeof raw.createdAt !== 'string') {
    throw new Error('Backup is missing a creation timestamp.')
  }
  if (!Array.isArray(raw.events) || !raw.events.every(isEvent)) {
    throw new Error('Backup contains invalid event records.')
  }
  if (!isSettings(raw.settings)) {
    throw new Error('Backup contains invalid settings.')
  }

  const events = raw.events.map((event) => ({
    ...event,
    schemaVersion: event.schemaVersion || CURRENT_EVENT_SCHEMA,
    note: event.note ?? null,
  }))

  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...raw.settings,
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
  }

  return {
    format: 'litter-log-backup',
    schemaVersion: CURRENT_BACKUP_SCHEMA,
    createdAt: raw.createdAt,
    events,
    settings,
  }
}

export function mergeBackupEvents(
  existing: BathroomEvent[],
  incoming: BathroomEvent[],
): { merged: BathroomEvent[]; imported: number; skippedDuplicates: number } {
  const byId = new Map(existing.map((e) => [e.id, e]))
  let imported = 0
  let skippedDuplicates = 0
  for (const event of incoming) {
    if (byId.has(event.id)) {
      skippedDuplicates += 1
      continue
    }
    byId.set(event.id, event)
    imported += 1
  }
  const merged = [...byId.values()].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )
  return { merged, imported, skippedDuplicates }
}

export function backupFilename(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `Litter-Log-Backup-${y}-${m}-${d}.json`
}
