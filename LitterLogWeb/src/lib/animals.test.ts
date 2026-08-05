import { describe, expect, it } from 'vitest'
import {
  canArchiveAnimal,
  createSeedAnimals,
  namesEqual,
  normalizeAnimalName,
  pickDefaultSelectedAnimalId,
  validateAnimalName,
} from './animals'

describe('animal helpers', () => {
  it('trims names and compares case-insensitively', () => {
    expect(normalizeAnimalName('  Cleo  ')).toBe('Cleo')
    expect(namesEqual('cleo', 'Cleo')).toBe(true)
    expect(namesEqual('Cleo', 'Bower')).toBe(false)
  })

  it('rejects empty and duplicate names', () => {
    const animals = createSeedAnimals()
    expect(validateAnimalName('   ', animals)).toMatch(/empty/i)
    expect(validateAnimalName('cleo', animals)).toMatch(/already used/i)
    expect(validateAnimalName('Mochi', animals)).toBeNull()
    expect(
      validateAnimalName('Cleo', animals, { excludeId: animals[0].id }),
    ).toBeNull()
  })

  it('defaults selection to Cleo', () => {
    const animals = createSeedAnimals()
    expect(pickDefaultSelectedAnimalId(animals)).toBe(
      animals.find((animal) => animal.name === 'Cleo')?.id,
    )
  })

  it('prevents archiving the final active animal', () => {
    const animals = createSeedAnimals()
    expect(canArchiveAnimal(animals, animals[0].id)).toBe(true)
    const onlyCleo = animals.map((animal, index) =>
      index === 0 ? animal : { ...animal, archived: true },
    )
    expect(canArchiveAnimal(onlyCleo, onlyCleo[0].id)).toBe(false)
  })
})
