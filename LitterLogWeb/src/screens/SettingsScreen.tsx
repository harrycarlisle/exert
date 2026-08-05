import { useEffect, useRef, useState } from 'react'
import {
  ANIMAL_COLOR_OPTIONS,
  PRIVACY_STATEMENT,
  SAFETY_MESSAGE,
  type AppearancePreference,
} from '../models/types'
import {
  activateWaitingServiceWorker,
  checkForAppUpdate,
  updateStatusMessage,
  type UpdateCheckStatus,
} from '../lib/appUpdates'
import { backupFilename } from '../lib/backup'
import { BUILD_SHA, shortBuildSha } from '../lib/buildInfo'
import { csvFilename, eventsToCsv } from '../lib/csv'
import { formatDate, parseISO } from '../lib/dates'
import {
  buildDiagnosticsText,
  copyTextToClipboard,
  readServiceWorkerDiagnostics,
} from '../lib/diagnostics'
import { isLikelyIPhoneSafari, isStandaloneDisplay } from '../lib/pwa'
import { readFileAsText, shareOrDownloadFile } from '../lib/share'
import type { LitterLogState } from '../state/useLitterLog'
import { Dialog } from '../components/Dialog'

interface Props {
  state: LitterLogState
  focusVet?: boolean
  showInstallHelp: boolean
  onShowInstallHelp: () => void
  needRefresh?: boolean
  onUpdateNow?: () => void
}

export function SettingsScreen({
  state,
  focusVet = false,
  showInstallHelp,
  onShowInstallHelp,
  needRefresh = false,
  onUpdateNow,
}: Props) {
  const {
    settings,
    events,
    animals,
    setScreen,
    updateSettings,
    clearHistory,
    importBackupText,
    markBackupExported,
    buildBackup,
    setStatus,
    addAnimal,
    renameAnimal,
    setAnimalColor,
    reorderAnimal,
    archiveAnimal,
    restoreAnimal,
    technicalStorageError,
    loadError,
    runStorageProbe,
    resetLocalStorage,
    storageBackend,
    storageDiagnostics,
  } = state
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmImport, setConfirmImport] = useState<File | null>(null)
  const [confirmResetStorage, setConfirmResetStorage] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [animalError, setAnimalError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showDiagnostics, setShowDiagnostics] = useState(false)
  const [probeResult, setProbeResult] = useState<string | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateCheckStatus>('idle')
  const [deployedSha, setDeployedSha] = useState<string | null>(null)
  const [diagnosticsCopied, setDiagnosticsCopied] = useState(false)
  const updateCheckInFlight = useRef(false)

  const showUpdateNow = needRefresh || updateStatus === 'ready'

  async function runUpdateCheck(options?: { quiet?: boolean }) {
    if (updateCheckInFlight.current) return
    updateCheckInFlight.current = true
    if (!options?.quiet) setUpdateStatus('checking')
    try {
      const result = await checkForAppUpdate({ knownWaiting: needRefresh })
      setDeployedSha(result.deployedSha)
      setUpdateStatus(result.status)
    } catch {
      if (!options?.quiet) setUpdateStatus('error')
    } finally {
      updateCheckInFlight.current = false
    }
  }

  useEffect(() => {
    void runUpdateCheck({ quiet: true })
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void runUpdateCheck({ quiet: true })
      }
    }
    const onFocus = () => {
      void runUpdateCheck({ quiet: true })
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + visibility only
  }, [])

  useEffect(() => {
    if (needRefresh) setUpdateStatus('ready')
  }, [needRefresh])

  const orderedAnimals = [...animals].sort((a, b) => {
    if (Boolean(a.isSystem) !== Boolean(b.isSystem)) {
      return a.isSystem ? 1 : -1
    }
    if (a.archived !== b.archived) return a.archived ? 1 : -1
    const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER
    const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER
    if (orderA !== orderB) return orderA - orderB
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  async function exportCsv() {
    try {
      const file = new File([eventsToCsv(events, animals)], csvFilename(), {
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

  async function runImport(file: File) {
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

  async function handleAddAnimal() {
    try {
      setAnimalError(null)
      await addAnimal(newName)
      setNewName('')
      setStatus({ kind: 'success', message: 'Animal added' })
    } catch (error) {
      setAnimalError(
        error instanceof Error ? error.message : 'Could not add animal.',
      )
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
        <h2>Animals</h2>
        <ul className="animal-settings-list">
          {orderedAnimals.map((animal) => (
            <li key={animal.id} className="animal-settings-row">
              <div className="animal-settings-main">
                {editingId === animal.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    aria-label={`Rename ${animal.name}`}
                    autoComplete="off"
                  />
                ) : (
                  <strong>
                    {animal.name}
                    {animal.archived ? (
                      <span className="muted"> · archived</span>
                    ) : null}
                    {animal.isSystem ? (
                      <span className="muted"> · assign via History</span>
                    ) : null}
                  </strong>
                )}
                {!animal.isSystem ? (
                  <div
                    className="color-swatches"
                    role="group"
                    aria-label={`Color for ${animal.name}`}
                  >
                    {ANIMAL_COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className="color-swatch"
                        style={{ background: color }}
                        aria-label={`Set color ${color}`}
                        aria-pressed={animal.color === color}
                        onClick={() => void setAnimalColor(animal.id, color)}
                      />
                    ))}
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => void setAnimalColor(animal.id, null)}
                    >
                      Clear
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="animal-settings-actions">
                {!animal.isSystem && !animal.archived ? (
                  <>
                    <button
                      type="button"
                      className="text-btn"
                      aria-label={`Move ${animal.name} up`}
                      onClick={() => void reorderAnimal(animal.id, 'up')}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="text-btn"
                      aria-label={`Move ${animal.name} down`}
                      onClick={() => void reorderAnimal(animal.id, 'down')}
                    >
                      Down
                    </button>
                  </>
                ) : null}
                {!animal.isSystem ? (
                  editingId === animal.id ? (
                    <>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => {
                          void renameAnimal(animal.id, editingName)
                            .then(() => {
                              setEditingId(null)
                              setAnimalError(null)
                              setStatus({
                                kind: 'success',
                                message: 'Animal renamed',
                              })
                            })
                            .catch((error: unknown) => {
                              setAnimalError(
                                error instanceof Error
                                  ? error.message
                                  : 'Could not rename.',
                              )
                            })
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="text-btn"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() => {
                        setEditingId(animal.id)
                        setEditingName(animal.name)
                      }}
                    >
                      Rename
                    </button>
                  )
                ) : null}
                {!animal.isSystem ? (
                  animal.archived ? (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() =>
                        void restoreAnimal(animal.id)
                          .then(() =>
                            setStatus({
                              kind: 'success',
                              message: `${animal.name} restored`,
                            }),
                          )
                          .catch((error: unknown) =>
                            setAnimalError(
                              error instanceof Error
                                ? error.message
                                : 'Could not restore.',
                            ),
                          )
                      }
                    >
                      Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-btn"
                      onClick={() =>
                        void archiveAnimal(animal.id)
                          .then(() =>
                            setStatus({
                              kind: 'success',
                              message: `${animal.name} archived`,
                            }),
                          )
                          .catch((error: unknown) =>
                            setAnimalError(
                              error instanceof Error
                                ? error.message
                                : 'Could not archive.',
                            ),
                          )
                      }
                    >
                      Archive
                    </button>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        <div className="form-field" style={{ marginTop: 12, marginBottom: 0 }}>
          <span>Add animal</span>
          <div className="btn-row">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name"
              autoComplete="off"
              aria-label="New animal name"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleAddAnimal()}
            >
              Add
            </button>
          </div>
        </div>
        {animalError ? <p className="field-error">{animalError}</p> : null}
      </div>

      <div className="settings-section card">
        <h2>Care contacts</h2>
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
              if (file) setConfirmImport(file)
              e.target.value = ''
            }}
          />
        </div>
        {importResult ? <p className="summary-meta">{importResult}</p> : null}
        <p className="muted" style={{ marginTop: 10 }}>
          Browser storage can still be cleared by iOS, Safari, or you. Export a
          JSON backup regularly so history can be restored. Import merges
          records and never silently replaces your current history.
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

      <div className="settings-section card">
        <h2>App updates</h2>
        <p className="muted">App version: {shortBuildSha(BUILD_SHA)}</p>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void runUpdateCheck()}
            disabled={
              updateStatus === 'checking' || updateStatus === 'updating'
            }
          >
            Check for updates
          </button>
          {showUpdateNow ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setUpdateStatus('updating')
                if (onUpdateNow) {
                  onUpdateNow()
                  return
                }
                void activateWaitingServiceWorker().then((ok) => {
                  if (!ok) setUpdateStatus('error')
                })
              }}
            >
              Update now
            </button>
          ) : null}
        </div>
        {updateStatusMessage(updateStatus) ? (
          <p className="summary-meta" aria-live="polite">
            {updateStatusMessage(updateStatus)}
          </p>
        ) : null}
      </div>

      <div className="settings-section card">
        <h2>Diagnostics</h2>
        <button
          type="button"
          className="text-btn"
          onClick={() => setShowDiagnostics((value) => !value)}
          aria-expanded={showDiagnostics}
        >
          {showDiagnostics
            ? 'Hide technical details'
            : 'Show technical details'}
        </button>
        {showDiagnostics ? (
          <div className="diagnostics-panel">
            <p className="muted">
              App version: {shortBuildSha(BUILD_SHA)}
              {BUILD_SHA !== 'dev' ? ` (${BUILD_SHA})` : ''}
            </p>
            <p className="muted">
              Storage backend: {storageBackend ?? '(none)'}
              {storageDiagnostics.authority
                ? ` · authority ${storageDiagnostics.authority}`
                : ''}
            </p>
            <p className="muted">
              Last error:{' '}
              {technicalStorageError
                ? technicalStorageError
                : 'No storage errors recorded in this session.'}
              {storageDiagnostics.lastErrorStage
                ? ` · stage ${storageDiagnostics.lastErrorStage}`
                : ''}
              {import.meta.env.DEV ? ' · development build' : ''}
            </p>
            <p className="muted">
              IndexedDB API: {String(storageDiagnostics.indexedDbApiPresent)} ·
              open: {String(storageDiagnostics.indexedDbOpenSucceeded)} ·
              localStorage: {String(storageDiagnostics.localStorageAvailable)} ·
              other backend has data:{' '}
              {String(storageDiagnostics.otherBackendHasData)}
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void (async () => {
                    const sw = await readServiceWorkerDiagnostics()
                    const text = buildDiagnosticsText({
                      storage: storageDiagnostics,
                      deployedSha,
                      serviceWorker: sw,
                    })
                    const ok = await copyTextToClipboard(text)
                    setDiagnosticsCopied(ok)
                    if (ok) {
                      window.setTimeout(() => setDiagnosticsCopied(false), 2500)
                    }
                  })()
                }}
              >
                Copy diagnostics
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  void runStorageProbe().then((result) => {
                    setProbeResult(
                      result.ok
                        ? `Open OK · version ${result.version} · stores: ${result.stores.join(', ') || '(none)'}`
                        : `Open failed · ${result.technical}`,
                    )
                  })
                }}
              >
                Test storage open
              </button>
            </div>
            {diagnosticsCopied ? (
              <p className="summary-meta" role="status">
                Diagnostics copied
              </p>
            ) : null}
            {probeResult ? <p className="muted">{probeResult}</p> : null}
            {loadError ? (
              <>
                <p className="muted">
                  Reset local Litter Log storage removes animals and records
                  from the current authoritative backend (
                  {storageBackend ?? storageDiagnostics.authority ?? 'unknown'}
                  ). The other backend is left untouched. Use only if recovery
                  keeps failing. This never runs automatically.
                </p>
                {events.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void exportBackup()}
                  >
                    Export JSON backup first
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => setConfirmResetStorage(true)}
                >
                  Reset local Litter Log storage
                </button>
              </>
            ) : (
              <p className="muted">
                Storage is working. The reset action stays hidden while recovery
                succeeds.
              </p>
            )}
          </div>
        ) : null}
      </div>

      <div className="settings-section card danger-zone">
        <h2>Delete All History</h2>
        <p>
          Permanently removes every litter record stored in this browser. Animal
          profiles are kept. This cannot be undone unless you previously
          exported a JSON backup.
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
            This permanently removes every litter record on this device. Animal
            profiles stay. This cannot be undone after confirmation.
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

      {confirmImport ? (
        <Dialog
          title="Import this backup?"
          onClose={() => setConfirmImport(null)}
        >
          <p>
            Import merges animals and events into your current local history. It
            does not wipe existing records. Duplicate event IDs are skipped.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmImport(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const file = confirmImport
                setConfirmImport(null)
                void runImport(file)
              }}
            >
              Import and merge
            </button>
          </div>
        </Dialog>
      ) : null}

      {confirmResetStorage ? (
        <Dialog
          title="Reset local storage?"
          onClose={() => setConfirmResetStorage(false)}
        >
          <p>
            This permanently deletes animals and litter records from the{' '}
            {storageBackend ?? storageDiagnostics.authority ?? 'current'}{' '}
            backend only. The other backend is not cleared. Export a JSON backup
            first if any records can still be read. This cannot be undone.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmResetStorage(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setConfirmResetStorage(false)
                void resetLocalStorage()
                  .then(() =>
                    setStatus({
                      kind: 'success',
                      message: 'Local storage reset',
                    }),
                  )
                  .catch((error: unknown) =>
                    setStatus({
                      kind: 'error',
                      message:
                        error instanceof Error
                          ? error.message
                          : 'Could not reset storage.',
                    }),
                  )
              }}
            >
              Reset storage
            </button>
          </div>
        </Dialog>
      ) : null}
    </section>
  )
}
