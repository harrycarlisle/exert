import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { EventEditor } from './components/EventEditor'
import { SafetyDialog } from './components/SafetyDialog'
import { StatusBanner } from './components/StatusBanner'
import { Dialog } from './components/Dialog'
import { HomeScreen } from './screens/HomeScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { isStandaloneDisplay } from './lib/pwa'
import { useLitterLog } from './state/useLitterLog'
import type { BathroomEvent } from './models/types'
import './styles/app.css'

export default function App() {
  const state = useLitterLog()
  const [pendingDelete, setPendingDelete] = useState<BathroomEvent | null>(null)
  const [focusVet, setFocusVet] = useState(false)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [showBackupReminder, setShowBackupReminder] = useState(false)
  const [showInstallHelp, setShowInstallHelp] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
  })

  useEffect(() => {
    const appearance = state.settings.appearance
    const root = document.documentElement
    if (appearance === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', appearance)
    }
  }, [state.settings.appearance])

  useEffect(() => {
    if (
      !isStandaloneDisplay() &&
      !state.settings.installPromptDismissed &&
      !state.loading
    ) {
      setShowInstallBanner(true)
    }
  }, [state.loading, state.settings.installPromptDismissed])

  useEffect(() => {
    if (
      state.events.length >= 30 &&
      !state.settings.lastBackupAt &&
      !state.settings.backupReminderDismissed
    ) {
      setShowBackupReminder(true)
    }
  }, [
    state.events.length,
    state.settings.lastBackupAt,
    state.settings.backupReminderDismissed,
  ])

  return (
    <div className="app-shell">
      <div className="sr-only" aria-live="polite">
        {state.announce}
      </div>

      {needRefresh ? (
        <div className="update-banner" role="status">
          <strong>Update available</strong>
          <span className="muted">
            Your records stay on this device. Apply the update when you are
            ready.
          </span>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void updateServiceWorker(true)}
            >
              Update now
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setNeedRefresh(false)}
            >
              Later
            </button>
          </div>
        </div>
      ) : null}

      {showInstallBanner && state.screen === 'home' ? (
        <div className="install-banner">
          <strong>Install on iPhone</strong>
          <ol>
            <li>Tap Safari’s Share button.</li>
            <li>Tap Add to Home Screen.</li>
            <li>Turn on Open as Web App if shown.</li>
            <li>Tap Add.</li>
          </ol>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowInstallBanner(false)
                void state.updateSettings({ installPromptDismissed: true })
              }}
            >
              Dismiss
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowInstallBanner(false)
                setShowInstallHelp(true)
                state.setScreen('settings')
              }}
            >
              Open instructions
            </button>
          </div>
        </div>
      ) : null}

      {showBackupReminder && state.screen === 'home' ? (
        <div className="backup-banner">
          <strong>Back up your history</strong>
          <span className="muted">
            You have {state.events.length} records and no backup yet. Export a
            JSON backup from Settings so Safari cannot erase your only copy.
          </span>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setShowBackupReminder(false)
                void state.updateSettings({ backupReminderDismissed: true })
              }}
            >
              Not now
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setShowBackupReminder(false)
                state.setScreen('settings')
              }}
            >
              Go to Settings
            </button>
          </div>
        </div>
      ) : null}

      {state.loading ? (
        <div className="card empty">Loading Litter Log…</div>
      ) : state.screen === 'history' ? (
        <HistoryScreen state={state} onDeleteRequest={setPendingDelete} />
      ) : state.screen === 'settings' ? (
        <SettingsScreen
          state={state}
          focusVet={focusVet}
          showInstallHelp={showInstallHelp}
          onShowInstallHelp={() => setShowInstallHelp(true)}
        />
      ) : (
        <HomeScreen state={state} onDeleteRequest={setPendingDelete} />
      )}

      {state.status ? (
        <StatusBanner
          status={state.status}
          onUndo={() => void state.undo()}
          onRetry={(type) => void state.log(type)}
          onDismiss={() => state.setStatus(null)}
        />
      ) : null}

      {state.editorMode ? (
        <EventEditor
          mode={state.editorMode}
          initial={state.editorEvent}
          onCancel={() => {
            state.setEditorMode(null)
            state.setEditorEvent(null)
          }}
          onSave={(event, isNew) => void state.saveEditor(event, isNew)}
        />
      ) : null}

      {state.showSafety ? (
        <SafetyDialog
          hasVetPhone={Boolean(state.settings.vetPhoneNumber.trim())}
          vetPhone={state.settings.vetPhoneNumber}
          onDismiss={() => void state.dismissSafety()}
          onAddVet={() => {
            void state.dismissSafety()
            setFocusVet(true)
            state.setScreen('settings')
          }}
        />
      ) : null}

      {pendingDelete ? (
        <Dialog
          title="Delete this entry?"
          onClose={() => setPendingDelete(null)}
        >
          <p>This cannot be undone unless you tap Undo immediately after.</p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                void state.remove(pendingDelete.id)
                setPendingDelete(null)
              }}
            >
              Delete
            </button>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}
