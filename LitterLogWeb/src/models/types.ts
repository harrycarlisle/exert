export type BathroomEventType = 'pee' | 'poo' | 'triedToPee'

export type EventSource = 'web-app'

export type AppearancePreference = 'system' | 'light' | 'dark'

export interface BathroomEvent {
  id: string
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
  catName: string
  vetPhoneNumber: string
  hapticsEnabled: boolean
  appearance: AppearancePreference
  lastSafetyWarningAt: string | null
  lastBackupAt: string | null
  backupReminderDismissed: boolean
  installPromptDismissed: boolean
  schemaVersion: number
}

export interface TodaySummary {
  peeCount: number
  pooCount: number
  triedCount: number
  mostRecentTimestamp: string | null
}

export interface LitterLogBackup {
  format: 'litter-log-backup'
  schemaVersion: number
  createdAt: string
  events: BathroomEvent[]
  settings: AppSettings
}

export const CURRENT_EVENT_SCHEMA = 1
export const CURRENT_SETTINGS_SCHEMA = 1
export const CURRENT_BACKUP_SCHEMA = 1

export const DEFAULT_SETTINGS: AppSettings = {
  catName: '',
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
