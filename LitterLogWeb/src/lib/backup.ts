import {
  createAnimalProfile,
  createSeedAnimals,
  createUnassignedAnimal,
  findAnimalByName,
  isReliableLegacyCatName,
  normalizeAnimalName,
  nextActiveAnimalId,
} from './animals'
import { toISO } from './dates'
import {
  CURRENT_ANIMAL_SCHEMA,
  CURRENT_BACKUP_SCHEMA,
  CURRENT_EVENT_SCHEMA,
  CURRENT_SETTINGS_SCHEMA,
  DEFAULT_SETTINGS,
  UNASSIGNED_ANIMAL_ID,
  type Animal,
  type AppSettings,
  ALL_EVENT_TYPES,
  type BathroomEvent,
  type BathroomEventType,
  type LitterLogBackup,
} from '../models/types'

const EVENT_TYPES: BathroomEventType[] = [...ALL_EVENT_TYPES]

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLegacyEvent(value: unknown): value is Omit<
  BathroomEvent,
  'animalId'
> & {
  animalId?: string
} {
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
      typeof value.note === 'string') &&
    (value.animalId === undefined || typeof value.animalId === 'string')
  )
}

function isAnimal(value: unknown): value is Animal {
  if (!isObject(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.createdAt === 'string' &&
    typeof value.archived === 'boolean' &&
    (value.color === undefined ||
      value.color === null ||
      typeof value.color === 'string') &&
    (value.displayOrder === undefined ||
      value.displayOrder === null ||
      typeof value.displayOrder === 'number') &&
    (value.isSystem === undefined || typeof value.isSystem === 'boolean')
  )
}

function isSettings(
  value: unknown,
): value is AppSettings & { catName?: string } {
  if (!isObject(value)) return false
  const hasLegacyCat =
    typeof value.catName === 'string' || value.catName === undefined
  const hasSelected =
    value.selectedAnimalId === null ||
    value.selectedAnimalId === undefined ||
    typeof value.selectedAnimalId === 'string'
  return (
    hasLegacyCat &&
    hasSelected &&
    typeof value.vetPhoneNumber === 'string' &&
    typeof value.hapticsEnabled === 'boolean' &&
    ['system', 'light', 'dark'].includes(value.appearance as string) &&
    typeof value.schemaVersion === 'number'
  )
}

export function createBackup(
  events: BathroomEvent[],
  settings: AppSettings,
  animals: Animal[],
  createdAt = new Date(),
): LitterLogBackup {
  return {
    format: 'litter-log-backup',
    schemaVersion: CURRENT_BACKUP_SCHEMA,
    createdAt: toISO(createdAt),
    animals,
    events,
    settings: {
      ...settings,
      selectedAnimalId: settings.selectedAnimalId,
      schemaVersion: CURRENT_SETTINGS_SCHEMA,
    },
  }
}

function normalizeImportedAnimal(raw: Animal): Animal {
  return {
    id: raw.id,
    name: normalizeAnimalName(raw.name),
    color: raw.color ?? null,
    createdAt: raw.createdAt,
    archived: Boolean(raw.archived),
    displayOrder: raw.displayOrder ?? null,
    isSystem: Boolean(raw.isSystem),
    schemaVersion: raw.schemaVersion || CURRENT_ANIMAL_SCHEMA,
  }
}

function buildAnimalsForLegacyBackup(
  settings: AppSettings & { catName?: string },
  events: Array<Omit<BathroomEvent, 'animalId'> & { animalId?: string }>,
): { animals: Animal[]; defaultAnimalId: string } {
  const animals = createSeedAnimals()
  const legacyName = settings.catName
  let defaultAnimalId =
    findAnimalByName(animals, 'Cleo')?.id ?? animals[0]?.id ?? ''

  if (isReliableLegacyCatName(legacyName)) {
    const match = findAnimalByName(animals, legacyName!)
    if (match) {
      defaultAnimalId = match.id
    } else {
      const custom = createAnimalProfile(legacyName!, {
        displayOrder: animals.length,
      })
      animals.push(custom)
      defaultAnimalId = custom.id
    }
  } else if (events.some((event) => !event.animalId)) {
    const unassigned = createUnassignedAnimal()
    animals.push(unassigned)
    defaultAnimalId = unassigned.id
  }

  return { animals, defaultAnimalId }
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
  if (!Array.isArray(raw.events) || !raw.events.every(isLegacyEvent)) {
    throw new Error('Backup contains invalid event records.')
  }
  if (!isSettings(raw.settings)) {
    throw new Error('Backup contains invalid settings.')
  }

  const settingsRaw = raw.settings
  let animals: Animal[]
  let defaultAnimalId: string

  if (Array.isArray(raw.animals)) {
    if (!raw.animals.every(isAnimal)) {
      throw new Error('Backup contains invalid animal records.')
    }
    animals = raw.animals.map(normalizeImportedAnimal)
    if (animals.length === 0) {
      const built = buildAnimalsForLegacyBackup(settingsRaw, raw.events)
      animals = built.animals
      defaultAnimalId = built.defaultAnimalId
    } else {
      defaultAnimalId =
        nextActiveAnimalId(animals, settingsRaw.selectedAnimalId) ??
        animals[0].id
    }
  } else {
    const built = buildAnimalsForLegacyBackup(settingsRaw, raw.events)
    animals = built.animals
    defaultAnimalId = built.defaultAnimalId
  }

  // Ensure every referenced animalId exists; otherwise map to Unassigned.
  const animalIds = new Set(animals.map((animal) => animal.id))
  let unassigned = animals.find(
    (animal) => animal.id === UNASSIGNED_ANIMAL_ID || animal.isSystem,
  )

  const events: BathroomEvent[] = raw.events.map((event) => {
    let animalId = event.animalId
    if (!animalId) {
      animalId = defaultAnimalId
    } else if (!animalIds.has(animalId)) {
      if (!unassigned) {
        unassigned = createUnassignedAnimal()
        animals = [...animals, unassigned]
        animalIds.add(unassigned.id)
      }
      animalId = unassigned.id
    }
    return {
      id: event.id,
      animalId,
      type: event.type,
      timestamp: event.timestamp,
      createdAt: event.createdAt,
      note: event.note ?? null,
      source: 'web-app' as const,
      schemaVersion: event.schemaVersion || CURRENT_EVENT_SCHEMA,
    }
  })

  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...settingsRaw,
    selectedAnimalId: nextActiveAnimalId(
      animals,
      settingsRaw.selectedAnimalId ?? defaultAnimalId,
    ),
    schemaVersion: CURRENT_SETTINGS_SCHEMA,
  }
  delete settings.catName

  return {
    format: 'litter-log-backup',
    schemaVersion: CURRENT_BACKUP_SCHEMA,
    createdAt: raw.createdAt,
    animals,
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

export function mergeBackupAnimals(
  existing: Animal[],
  incoming: Animal[],
): { merged: Animal[]; imported: number; skippedDuplicates: number } {
  const byId = new Map(existing.map((animal) => [animal.id, animal]))
  const byName = new Map(
    existing.map((animal) => [animal.name.toLocaleLowerCase(), animal]),
  )
  let imported = 0
  let skippedDuplicates = 0

  for (const animal of incoming) {
    const normalized = normalizeImportedAnimal(animal)
    if (byId.has(normalized.id)) {
      skippedDuplicates += 1
      continue
    }
    const nameKey = normalized.name.toLocaleLowerCase()
    const nameCollision = byName.get(nameKey)
    if (nameCollision) {
      // Preserve stable local id; skip importing the colliding profile.
      skippedDuplicates += 1
      continue
    }
    byId.set(normalized.id, normalized)
    byName.set(nameKey, normalized)
    imported += 1
  }

  return {
    merged: [...byId.values()],
    imported,
    skippedDuplicates,
  }
}

export function backupFilename(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `Litter-Log-Backup-${y}-${m}-${d}.json`
}
