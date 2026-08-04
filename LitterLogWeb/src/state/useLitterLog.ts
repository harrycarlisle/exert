import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteAllEvents,
  deleteEvent,
  fetchEvents,
  fetchSettings,
  putEvent,
  putManyEvents,
  requestPersistentStorage,
  saveSettings,
  StorageError,
} from '../db/database'
import { createBackup, mergeBackupEvents, parseBackup } from '../lib/backup'
import { TapDebouncer } from '../lib/debounce'
import {
  playErrorHaptic,
  playImpactHaptic,
  playSuccessHaptic,
} from '../lib/haptics'
import { shouldShowSafetyNotice } from '../lib/safety'
import { calculateTodaySummary } from '../lib/summary'
import { toISO } from '../lib/dates'
import {
  CURRENT_EVENT_SCHEMA,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BathroomEvent,
  type BathroomEventType,
} from '../models/types'

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export type Screen = 'home' | 'history' | 'settings'

export interface StatusBanner {
  kind: 'success' | 'error'
  message: string
  undoId?: string
  retryType?: BathroomEventType
}

export function useLitterLog() {
  const [events, setEvents] = useState<BathroomEvent[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [screen, setScreen] = useState<Screen>('home')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusBanner | null>(null)
  const [showSafety, setShowSafety] = useState(false)
  const [editorEvent, setEditorEvent] = useState<BathroomEvent | null>(null)
  const [editorMode, setEditorMode] = useState<'add' | 'edit' | null>(null)
  const [announce, setAnnounce] = useState('')
  const debouncer = useRef(new TapDebouncer())
  const deletedForUndo = useRef<BathroomEvent | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [nextEvents, nextSettings] = await Promise.all([
        fetchEvents(),
        fetchSettings(),
      ])
      setEvents(nextEvents)
      setSettings(nextSettings)
      setLoadError(null)
    } catch (error) {
      const message =
        error instanceof StorageError
          ? error.message
          : 'Could not load litter records.'
      setLoadError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    void requestPersistentStorage()
  }, [refresh])

  const todaySummary = useMemo(() => calculateTodaySummary(events), [events])
  const recentEvents = useMemo(() => events.slice(0, 5), [events])

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const next = await saveSettings({ ...settings, ...partial })
      setSettings(next)
      return next
    },
    [settings],
  )

  const log = useCallback(
    async (type: BathroomEventType) => {
      if (!debouncer.current.shouldAccept(type)) return null
      playImpactHaptic(settings.hapticsEnabled)

      const now = new Date()
      const event: BathroomEvent = {
        id: createId(),
        type,
        timestamp: toISO(now),
        createdAt: toISO(now),
        note: null,
        source: 'web-app',
        schemaVersion: CURRENT_EVENT_SCHEMA,
      }

      try {
        await putEvent(event)
        const nextEvents = [event, ...events]
        setEvents(nextEvents)
        const time = now.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        })
        const label =
          type === 'pee' ? 'Pee' : type === 'poo' ? 'Poo' : 'Tried to Pee'
        const message = `${label} recorded at ${time}`
        setStatus({ kind: 'success', message, undoId: event.id })
        setAnnounce(message)
        playSuccessHaptic(settings.hapticsEnabled)

        if (shouldShowSafetyNotice(event, nextEvents, settings, now)) {
          setShowSafety(true)
        }
        return event
      } catch (error) {
        const message =
          error instanceof StorageError
            ? error.message
            : 'Could not save that entry.'
        setStatus({ kind: 'error', message, retryType: type })
        setAnnounce(message)
        playErrorHaptic(settings.hapticsEnabled)
        return null
      }
    },
    [events, settings],
  )

  const undo = useCallback(async () => {
    if (!status?.undoId) return
    try {
      const undone = events.find((e) => e.id === status.undoId)
      await deleteEvent(status.undoId)
      setEvents((prev) => prev.filter((e) => e.id !== status.undoId))
      if (undone) debouncer.current.reset(undone.type)
      setStatus({ kind: 'success', message: 'Entry undone' })
      setAnnounce('Entry undone')
    } catch (error) {
      const message =
        error instanceof StorageError
          ? error.message
          : 'Could not undo that entry.'
      setStatus({ kind: 'error', message })
    }
  }, [events, status])

  const remove = useCallback(
    async (id: string) => {
      const previous = events
      try {
        await deleteEvent(id)
        const deleted = previous.find((e) => e.id === id) ?? null
        deletedForUndo.current = deleted
        setEvents((prev) => prev.filter((e) => e.id !== id))
        setStatus({
          kind: 'success',
          message: 'Entry deleted',
          undoId: deleted?.id,
        })
        setAnnounce('Entry deleted')
      } catch (error) {
        const message =
          error instanceof StorageError
            ? error.message
            : 'Could not delete that entry.'
        setStatus({ kind: 'error', message })
      }
    },
    [events],
  )

  const undoDeletionOrLast = useCallback(async () => {
    const stashed = deletedForUndo.current
    if (stashed && status?.message === 'Entry deleted') {
      await putEvent(stashed)
      setEvents((prev) =>
        [stashed, ...prev.filter((e) => e.id !== stashed.id)].sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
      )
      deletedForUndo.current = null
      setStatus({ kind: 'success', message: 'Deletion undone' })
      setAnnounce('Deletion undone')
      return
    }
    await undo()
  }, [status, undo])

  const saveEditor = useCallback(
    async (event: BathroomEvent, isNew: boolean) => {
      try {
        await putEvent(event)
        setEvents((prev) => {
          const without = prev.filter((e) => e.id !== event.id)
          return [event, ...without].sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
          )
        })
        setEditorMode(null)
        setEditorEvent(null)
        setStatus({
          kind: 'success',
          message: isNew ? 'Entry added' : 'Entry updated',
        })
        setAnnounce(isNew ? 'Entry added' : 'Entry updated')
        playSuccessHaptic(settings.hapticsEnabled)
      } catch (error) {
        const message =
          error instanceof StorageError
            ? error.message
            : 'Could not save changes.'
        setStatus({ kind: 'error', message })
      }
    },
    [settings.hapticsEnabled],
  )

  const clearHistory = useCallback(async () => {
    await deleteAllEvents()
    setEvents([])
    setStatus({ kind: 'success', message: 'All history deleted' })
    setAnnounce('All history deleted')
  }, [])

  const importBackupText = useCallback(
    async (text: string) => {
      const backup = parseBackup(JSON.parse(text) as unknown)
      const { merged, imported, skippedDuplicates } = mergeBackupEvents(
        events,
        backup.events,
      )
      await putManyEvents(merged)
      const nextSettings = await saveSettings({
        ...settings,
        ...backup.settings,
        // Preserve local install/backup reminder prefs unless backup has newer backup stamp.
        installPromptDismissed: settings.installPromptDismissed,
        backupReminderDismissed: settings.backupReminderDismissed,
        lastBackupAt: settings.lastBackupAt,
        catName: backup.settings.catName || settings.catName,
        vetPhoneNumber:
          backup.settings.vetPhoneNumber || settings.vetPhoneNumber,
      })
      setEvents(merged)
      setSettings(nextSettings)
      return { imported, skippedDuplicates }
    },
    [events, settings],
  )

  const markBackupExported = useCallback(async () => {
    const next = await saveSettings({
      ...settings,
      lastBackupAt: toISO(),
      backupReminderDismissed: false,
    })
    setSettings(next)
  }, [settings])

  const dismissSafety = useCallback(async () => {
    const next = await saveSettings({
      ...settings,
      lastSafetyWarningAt: toISO(),
    })
    setSettings(next)
    setShowSafety(false)
  }, [settings])

  const buildBackup = useCallback(
    () => createBackup(events, settings),
    [events, settings],
  )

  return {
    events,
    settings,
    screen,
    setScreen,
    loading,
    loadError,
    status,
    setStatus,
    showSafety,
    todaySummary,
    recentEvents,
    announce,
    editorEvent,
    editorMode,
    setEditorEvent,
    setEditorMode,
    refresh,
    log,
    undo: undoDeletionOrLast,
    remove,
    saveEditor,
    updateSettings,
    clearHistory,
    importBackupText,
    markBackupExported,
    dismissSafety,
    buildBackup,
  }
}

export type LitterLogState = ReturnType<typeof useLitterLog>
