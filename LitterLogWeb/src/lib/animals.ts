import {
  ANIMAL_COLOR_OPTIONS,
  CURRENT_ANIMAL_SCHEMA,
  SEED_ANIMAL_NAMES,
  UNASSIGNED_ANIMAL_ID,
  UNASSIGNED_ANIMAL_NAME,
  type Animal,
} from '../models/types'
import { toISO } from './dates'

export function createId(prefix = 'animal'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export function normalizeAnimalName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function namesEqual(a: string, b: string): boolean {
  return (
    normalizeAnimalName(a).toLocaleLowerCase() ===
    normalizeAnimalName(b).toLocaleLowerCase()
  )
}

export function isBlankAnimalName(name: string): boolean {
  return normalizeAnimalName(name).length === 0
}

/** Empty or generic placeholder names are not reliable legacy identities. */
export function isReliableLegacyCatName(
  name: string | null | undefined,
): boolean {
  if (!name) return false
  const normalized = normalizeAnimalName(name)
  if (!normalized) return false
  const lower = normalized.toLocaleLowerCase()
  return !['cat', 'my cat', 'kitten', 'the cat'].includes(lower)
}

export function findAnimalByName(
  animals: Animal[],
  name: string,
): Animal | undefined {
  return animals.find((animal) => namesEqual(animal.name, name))
}

export function activeAnimals(animals: Animal[]): Animal[] {
  return animals
    .filter((animal) => !animal.archived && !animal.isSystem)
    .sort(compareAnimals)
}

export function compareAnimals(a: Animal, b: Animal): number {
  const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER
  const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER
  if (orderA !== orderB) return orderA - orderB
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
}

export function validateAnimalName(
  name: string,
  animals: Animal[],
  options?: { excludeId?: string },
): string | null {
  const normalized = normalizeAnimalName(name)
  if (!normalized) return 'Name can’t be empty.'
  const duplicate = animals.some(
    (animal) =>
      animal.id !== options?.excludeId && namesEqual(animal.name, normalized),
  )
  if (duplicate) return 'That name is already used.'
  return null
}

export function createAnimalProfile(
  name: string,
  options?: {
    id?: string
    color?: string | null
    createdAt?: string
    archived?: boolean
    displayOrder?: number | null
    isSystem?: boolean
  },
): Animal {
  return {
    id: options?.id ?? createId('animal'),
    name: normalizeAnimalName(name),
    color: options?.color ?? null,
    createdAt: options?.createdAt ?? toISO(),
    archived: options?.archived ?? false,
    displayOrder: options?.displayOrder ?? null,
    isSystem: options?.isSystem ?? false,
    schemaVersion: CURRENT_ANIMAL_SCHEMA,
  }
}

export function createUnassignedAnimal(createdAt = toISO()): Animal {
  return createAnimalProfile(UNASSIGNED_ANIMAL_NAME, {
    id: UNASSIGNED_ANIMAL_ID,
    archived: true,
    isSystem: true,
    displayOrder: 9999,
    createdAt,
    color: null,
  })
}

export function createSeedAnimals(createdAt = toISO()): Animal[] {
  return SEED_ANIMAL_NAMES.map((name, index) =>
    createAnimalProfile(name, {
      createdAt,
      displayOrder: index,
      color: ANIMAL_COLOR_OPTIONS[index % ANIMAL_COLOR_OPTIONS.length],
    }),
  )
}

export function animalNameMap(animals: Animal[]): Map<string, string> {
  return new Map(animals.map((animal) => [animal.id, animal.name]))
}

export function resolveAnimalName(
  animals: Animal[],
  animalId: string,
  fallback = 'Unknown',
): string {
  return animals.find((animal) => animal.id === animalId)?.name ?? fallback
}

export function pickDefaultSelectedAnimalId(animals: Animal[]): string | null {
  const active = activeAnimals(animals)
  if (active.length === 0) return null
  const cleo = active.find((animal) => namesEqual(animal.name, 'Cleo'))
  return cleo?.id ?? active[0].id
}

export function nextActiveAnimalId(
  animals: Animal[],
  preferredId: string | null | undefined,
): string | null {
  const active = activeAnimals(animals)
  if (active.length === 0) return null
  if (preferredId && active.some((animal) => animal.id === preferredId)) {
    return preferredId
  }
  return pickDefaultSelectedAnimalId(animals)
}

export function canArchiveAnimal(animals: Animal[], animalId: string): boolean {
  const animal = animals.find((item) => item.id === animalId)
  if (!animal || animal.archived || animal.isSystem) return false
  return activeAnimals(animals).length > 1
}
