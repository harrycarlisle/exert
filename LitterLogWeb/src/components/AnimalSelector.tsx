import type { CSSProperties } from 'react'
import type { Animal } from '../models/types'

interface Props {
  animals: Animal[]
  selectedId: string | null
  onSelect: (animalId: string) => void
}

export function AnimalSelector({ animals, selectedId, onSelect }: Props) {
  if (animals.length === 0) return null

  return (
    <div
      className="animal-selector"
      role="radiogroup"
      aria-label="Select animal"
    >
      {animals.map((animal) => {
        const selected = animal.id === selectedId
        return (
          <button
            key={animal.id}
            type="button"
            role="radio"
            className="animal-pill"
            aria-checked={selected}
            aria-label={animal.name}
            onClick={() => onSelect(animal.id)}
            style={
              animal.color
                ? ({ '--animal-color': animal.color } as CSSProperties)
                : undefined
            }
          >
            <span className="animal-pill-label">{animal.name}</span>
          </button>
        )
      })}
    </div>
  )
}
