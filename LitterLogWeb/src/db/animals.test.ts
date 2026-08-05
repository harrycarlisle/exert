import { beforeEach, describe, expect, it } from 'vitest'
import {
  deleteDatabaseForTests,
  fetchAnimals,
  fetchSettings,
  putAnimal,
  saveSettings,
} from './database'
import {
  canArchiveAnimal,
  createAnimalProfile,
  validateAnimalName,
} from '../lib/animals'

describe('animal persistence', () => {
  beforeEach(async () => {
    await deleteDatabaseForTests()
  })

  it('adds a third animal', async () => {
    const animals = await fetchAnimals()
    expect(animals).toHaveLength(2)
    const mochi = createAnimalProfile('Mochi', { displayOrder: 2 })
    await putAnimal(mochi)
    const next = await fetchAnimals()
    expect(next.map((animal) => animal.name).sort()).toEqual([
      'Bower',
      'Cleo',
      'Mochi',
    ])
  })

  it('renames without changing id', async () => {
    const animals = await fetchAnimals()
    const cleo = animals.find((animal) => animal.name === 'Cleo')!
    await putAnimal({ ...cleo, name: 'Cleopatra' })
    const next = await fetchAnimals()
    const renamed = next.find((animal) => animal.id === cleo.id)
    expect(renamed?.name).toBe('Cleopatra')
  })

  it('rejects duplicate names case-insensitively', async () => {
    const animals = await fetchAnimals()
    expect(validateAnimalName('bower', animals)).toMatch(/already used/i)
  })

  it('archives and restores while keeping one active animal', async () => {
    const animals = await fetchAnimals()
    const bower = animals.find((animal) => animal.name === 'Bower')!
    const cleo = animals.find((animal) => animal.name === 'Cleo')!
    expect(canArchiveAnimal(animals, bower.id)).toBe(true)
    await putAnimal({ ...bower, archived: true })
    let next = await fetchAnimals()
    expect(next.find((animal) => animal.id === bower.id)?.archived).toBe(true)
    expect(canArchiveAnimal(next, cleo.id)).toBe(false)

    await saveSettings({
      ...(await fetchSettings()),
      selectedAnimalId: bower.id,
    })
    // Selecting an archived animal should resolve to an active one on fetch.
    const settings = await fetchSettings()
    expect(settings.selectedAnimalId).toBe(cleo.id)

    await putAnimal({ ...bower, archived: false })
    next = await fetchAnimals()
    expect(next.find((animal) => animal.id === bower.id)?.archived).toBe(false)
  })
})
