import { useState } from 'react'
import { ANIMAL_COLOR_OPTIONS } from '../models/types'
import { Dialog } from './Dialog'

interface Props {
  onCancel: () => void
  onAdd: (name: string, color: string | null) => Promise<void>
}

export function AddAnimalSheet({ onCancel, onAdd }: Props) {
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | null>(
    ANIMAL_COLOR_OPTIONS[0] ?? null,
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleAdd() {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onAdd(name, color)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add animal.')
      setSaving(false)
    }
  }

  return (
    <Dialog title="Add animal" onClose={onCancel}>
      <div className="form-field">
        <label>
          <span>Animal name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            autoComplete="off"
            autoFocus
            aria-label="Animal name"
          />
        </label>
      </div>
      <div className="form-field">
        <span>Profile color (optional)</span>
        <div className="color-swatches" role="group" aria-label="Profile color">
          {ANIMAL_COLOR_OPTIONS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className="color-swatch"
              style={{ background: swatch }}
              aria-label={`Color ${swatch}`}
              aria-pressed={color === swatch}
              onClick={() => setColor(swatch)}
            />
          ))}
          <button
            type="button"
            className="text-btn"
            onClick={() => setColor(null)}
          >
            Clear
          </button>
        </div>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void handleAdd()}
          disabled={saving}
        >
          Add animal
        </button>
      </div>
    </Dialog>
  )
}
