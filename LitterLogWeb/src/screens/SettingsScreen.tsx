import { useRef, useState } from 'react'
import {
  PRIVACY_STATEMENT,
  SAFETY_MESSAGE,
  type AppearancePreference,
} from '../models/types'
import { backupFilename } from '../lib/backup'
import { csvFilename, eventsToCsv } from '../lib/csv'
import { formatDate, parseISO } from '../lib/dates'
import { isLikelyIPhoneSafari, isStandaloneDisplay } from '../lib/pwa'
import { readFileAsText, shareOrDownloadFile } from '../lib/share'
import type { LitterLogState } from '../state/useLitterLog'
import { Dialog } from '../components/Dialog'

interface Props {
  state: LitterLogState
  focusVet?: boolean
  showInstallHelp: boolean
  onShowInstallHelp: () => void
}

export function SettingsScreen({
  state,
  focusVet = false,
  showInstallHelp,
  onShowInstallHelp,
}: Props) {
  const {
    settings,
    events,
    setScreen,
    updateSettings,
    clearHistory,
    importBackupText,
    markBackupExported,
    buildBackup,
    setStatus,
  } = state
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)

  async function exportCsv() {
    try {
      const file = new File([eventsToCsv(events)], csvFilename(), {
        type: 'text/csv;charset=utf-8',
      })
      const result = await shareOrDownloadFile(file)
      setStatus({
        kind: 'success',
        message:
          result === 'shared' ? 'CSV ready to share' : 'CSV download started',
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setStatus({ kind: 'error', message: 'Could not export CSV.' })
    }
  }

  async function exportBackup() {
    try {
      const backup = buildBackup()
      const file = new File(
        [JSON.stringify(backup, null, 2)],
        backupFilename(),
        { type: 'application/json;charset=utf-8' },
      )
      const result = await shareOrDownloadFile(file)
      await markBackupExported()
      setStatus({
        kind: 'success',
        message:
          result === 'shared'
            ? 'Backup ready to share'
            : 'Backup download started',
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setStatus({ kind: 'error', message: 'Could not export backup.' })
    }
  }

  async function onImportFile(file: File) {
    try {
      const text = await readFileAsText(file)
      const result = await importBackupText(text)
      setImportResult(
        `Imported ${result.imported} event${result.imported === 1 ? '' : 's'}. Skipped ${result.skippedDuplicates} duplicate${result.skippedDuplicates === 1 ? '' : 's'}.`,
      )
      setStatus({ kind: 'success', message: 'Backup imported' })
    } catch (error) {
      setImportResult(null)
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Could not import that backup.',
      })
    }
  }

  return (
    <section>
      <header className="topbar">
        <div>
          <h1>Settings</h1>
          <p className="subtitle">{events.length} records on this device</p>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setScreen('home')}
        >
          Back
        </button>
      </header>

      <div className="settings-section card">
        <h2>Cat</h2>
        <div className="form-field">
          <span>Cat name (optional)</span>
          <input
            value={settings.catName}
            onChange={(e) => void updateSettings({ catName: e.target.value })}
            placeholder="e.g. Mochi"
            autoComplete="off"
          />
        </div>
        <div className="form-field">
          <span>Vet phone (optional)</span>
          <input
            value={settings.vetPhoneNumber}
            onChange={(e) =>
              void updateSettings({ vetPhoneNumber: e.target.value })
            }
            placeholder="Phone number"
            inputMode="tel"
            autoFocus={focusVet}
          />
        </div>
      </div>

      <div className="settings-section card">
        <h2>Preferences</h2>
        <div className="toggle-row">
          <span>Haptics</span>
          <input
            type="checkbox"
            checked={settings.hapticsEnabled}
            onChange={(e) =>
              void updateSettings({ hapticsEnabled: e.target.checked })
            }
            aria-label="Enable haptics"
          />
        </div>
        <div className="form-field">
          <span>Appearance</span>
          <select
            value={settings.appearance}
            onChange={(e) =>
              void updateSettings({
                appearance: e.target.value as AppearancePreference,
              })
            }
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>
      </div>

      <div className="settings-section card">
        <h2>Data</h2>
        <p>
          Last backup:{' '}
          {settings.lastBackupAt
            ? formatDate(parseISO(settings.lastBackupAt))
            : 'Never'}
        </p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportCsv}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportBackup}
          >
            Export JSON Backup
          </button>
        </div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => fileRef.current?.click()}
          >
            Import JSON Backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void onImportFile(file)
              e.target.value = ''
            }}
          />
        </div>
        {importResult ? <p className="summary-meta">{importResult}</p> : null}
        <p className="muted" style={{ marginTop: 10 }}>
          Browser storage can still be cleared by iOS, Safari, or you. Export a
          JSON backup regularly so history can be restored.
        </p>
      </div>

      <div className="settings-section card">
        <h2>Install on iPhone</h2>
        {isStandaloneDisplay() ? (
          <p>Litter Log is already running as a Home Screen web app.</p>
        ) : (
          <>
            <p>
              Add Litter Log from Safari for a standalone icon. This web version
              does not provide a native interactive iOS widget.
            </p>
            {(showInstallHelp || isLikelyIPhoneSafari()) && (
              <ol>
                <li>Tap Safari’s Share button.</li>
                <li>Tap Add to Home Screen.</li>
                <li>Turn on Open as Web App if that option appears.</li>
                <li>Tap Add.</li>
              </ol>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onShowInstallHelp}
            >
              Show install steps
            </button>
          </>
        )}
      </div>

      <div className="settings-section card">
        <h2>Urinary safety</h2>
        <p>{SAFETY_MESSAGE}</p>
      </div>

      <div className="settings-section card">
        <h2>Privacy</h2>
        <p>{PRIVACY_STATEMENT}</p>
      </div>

      <div className="settings-section card danger-zone">
        <h2>Delete All History</h2>
        <p>
          Permanently removes every litter record stored in this browser. This
          cannot be undone unless you previously exported a JSON backup.
        </p>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setConfirmDelete(true)}
        >
          Delete All History
        </button>
      </div>

      {confirmDelete ? (
        <Dialog
          title="Delete all history?"
          onClose={() => setConfirmDelete(false)}
        >
          <p>
            This permanently removes every litter record on this device. This
            cannot be undone after confirmation.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                void clearHistory()
                setConfirmDelete(false)
              }}
            >
              Delete everything
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  )
}
