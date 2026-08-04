import { SAFETY_MESSAGE } from '../models/types'
import { Dialog } from './Dialog'

interface Props {
  hasVetPhone: boolean
  vetPhone: string
  onDismiss: () => void
  onAddVet: () => void
}

export function SafetyDialog({
  hasVetPhone,
  vetPhone,
  onDismiss,
  onAddVet,
}: Props) {
  const digits = vetPhone.replace(/[^\d+]/g, '')

  return (
    <Dialog title="Urinary Safety" onClose={onDismiss}>
      <p>{SAFETY_MESSAGE}</p>
      <p className="muted">
        This notice is informational and does not diagnose your cat or replace
        veterinary care.
      </p>
      <div className="btn-row">
        {hasVetPhone ? (
          <a
            className="btn btn-primary"
            href={`tel:${digits}`}
            onClick={onDismiss}
          >
            Call Vet
          </a>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onAddVet}>
            Add Vet Number
          </button>
        )}
        <button type="button" className="btn btn-secondary" onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </Dialog>
  )
}
