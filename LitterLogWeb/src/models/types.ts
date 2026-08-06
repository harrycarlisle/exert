export type BathroomEventType =
  'pee' | 'poo' | 'vomit' | 'hairball' | 'triedToPee'

export const ALL_EVENT_TYPES: BathroomEventType[] = [
  'pee',
  'poo',
  'vomit',
  'hairball',
  'triedToPee',
]

export function isBathroomEventType(
  value: unknown,
): value is BathroomEventType {
  return (
    typeof value === 'string' && (ALL_EVENT_TYPES as string[]).includes(value)
  )
}

export type EventSource = 'web-app'

export type AppearancePreference = 'system' | 'light' | 'dark'

export interface Animal {
  id: string
  name: string
  /** Optional profile color (CSS color string). */
  color?: string | null
  createdAt: string
  archived: boolean
  displayOrder?: number | null
  /** System profiles such as Unassigned are not shown in the logging selector. */
  isSystem?: boolean
  schemaVersion: number
}

export interface BathroomEvent {
  id: string
  /** Stable animal profile id — never rely on display name alone. */
  animalId: string
  type: BathroomEventType
  /** Exact event time as ISO 8601 string (machine-readable). */
  timestamp: string
  /** When the record was created in storage. */
  createdAt: string
  note?: string | null
  source: EventSource
  schemaVersion: number
}

export interface AppSettings {
  selectedAnimalId: string | null
  vetPhoneNumber: string
  hapticsEnabled: boolean
  appearance: AppearancePreference
  lastSafetyWarningAt: string | null
  lastBackupAt: string | null
  backupReminderDismissed: boolean
  installPromptDismissed: boolean
  schemaVersion: number
  /** Legacy field retained only while reading older backups / local rows. */
  catName?: string
}

export interface TodaySummary {
  peeCount: number
  pooCount: number
  vomitCount: number
  hairballCount: number
  triedCount: number
  mostRecentTimestamp: string | null
}

export interface LitterLogBackup {
  format: 'litter-log-backup'
  schemaVersion: number
  createdAt: string
  animals: Animal[]
  events: BathroomEvent[]
  settings: AppSettings
}

export const CURRENT_EVENT_SCHEMA = 2
export const CURRENT_SETTINGS_SCHEMA = 2
export const CURRENT_BACKUP_SCHEMA = 2
export const CURRENT_ANIMAL_SCHEMA = 1

export const UNASSIGNED_ANIMAL_ID = 'animal_unassigned'
export const UNASSIGNED_ANIMAL_NAME = 'Unassigned'

export const SEED_ANIMAL_NAMES = ['Cleo', 'Bower'] as const

export const ANIMAL_COLOR_OPTIONS = [
  '#2E6F73',
  '#C9A227',
  '#8B5E3C',
  '#C47865',
  '#5B7C99',
  '#6B8F71',
] as const

export const DEFAULT_SETTINGS: AppSettings = {
  selectedAnimalId: null,
  vetPhoneNumber: '',
  hapticsEnabled: true,
  appearance: 'system',
  lastSafetyWarningAt: null,
  lastBackupAt: null,
  backupReminderDismissed: false,
  installPromptDismissed: false,
  schemaVersion: CURRENT_SETTINGS_SCHEMA,
}

export const EVENT_META: Record<
  BathroomEventType,
  {
    label: string
    shortLabel: string
    description: string
  }
> = {
  pee: {
    label: 'Pee',
    shortLabel: 'Pee',
    description: 'Records that the cat successfully urinated',
  },
  poo: {
    label: 'Poo',
    shortLabel: 'Poo',
    description: 'Records that the cat defecated',
  },
  vomit: {
    label: 'Vomit',
    shortLabel: 'Vomit',
    description: 'Records that the cat vomited',
  },
  hairball: {
    label: 'Hairball',
    shortLabel: 'Hairball',
    description: 'Records that the cat produced a hairball',
  },
  triedToPee: {
    label: 'Tried to Pee',
    shortLabel: 'Tried',
    description:
      'Records that the cat tried to urinate with little or no urine',
  },
}

export const SAFETY_MESSAGE =
  'Repeated straining with little or no urine can be an emergency, especially in male cats. Contact a veterinarian or emergency clinic immediately if your cat is repeatedly trying to urinate, producing little or no urine, crying, vomiting, hiding, or appearing distressed.'

export const PRIVACY_STATEMENT =
  'Your litter records are stored locally on this device. Litter Log does not create an account, track your activity, or upload your records. Records leave your device only when you intentionally export or share them.'

/** User-facing copy when persistence fails while saving an entry. */
export const STORAGE_SAVE_ERROR =
  'Litter Log couldn’t access storage on this device. Your entry wasn’t saved.'

/** User-facing copy when storage cannot be opened for reading. */
export const STORAGE_LOAD_ERROR =
  'Litter Log couldn’t access storage on this device. Your entry wasn’t saved.'
