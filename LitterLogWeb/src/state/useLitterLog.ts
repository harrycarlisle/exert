import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  deleteAllEvents,
  deleteEvent,
  fetchAnimals,
  fetchEvents,
  fetchSettings,
  getLastTechnicalStorageError,
  probeIndexedDBOpen,
  putAnimal,
  putEvent,
  putManyAnimals,
  putManyEvents,
  recoverStorage,
  requestPersistentStorage,
  resetLocalLitterLogStorage,
  saveSettings,
  StorageError,
} from '../db/database'
import {
  activeAnimals,
  canArchiveAnimal,
  createAnimalProfile,
  nextActiveAnimalId,
  normalizeAnimalName,
  resolveAnimalName,
  validateAnimalName,
} from '../lib/animals'
import {
  createBackup,
  mergeBackupAnimals,
  mergeBackupEvents,
  parseBackup,
} from '../lib/backup'
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
  STORAGE_LOAD_ERROR,
  STORAGE_SAVE_ERROR,
  type Animal,
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
  retryLoad?: boolean
}

function loggedMessage(type: BathroomEventType, animalName: string): string {
  if (type === 'pee') return `Pee logged for ${animalName}`
  if (type === 'poo') return `Poo logged for ${animalName}`
  return `Tried to pee logged for ${animalName}`
}

export function useLitterLog() {
  const [events, setEvents] = useState<BathroomEvent[]>([])
  const [animals, setAnimals] = useState<Animal[]>([])
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

  const selectedAnimalId = settings.selectedAnimalId
  const selectedAnimal = useMemo(
    () => animals.find((animal) => animal.id === selectedAnimalId) ?? null,
    [animals, selectedAnimalId],
  )
  const selectableAnimals = useMemo(() => activeAnimals(animals), [animals])

  const refresh = useCallback(async () => {
    try {
      const [nextEvents, nextSettings, nextAnimals] = await Promise.all([
        fetchEvents(),
        fetchSettings(),
        fetchAnimals(),
      ])
      const resolvedSelected = nextActiveAnimalId(
        nextAnimals,
        nextSettings.selectedAnimalId,
      )
      let settingsToUse = nextSettings
      if (resolvedSelected !== nextSettings.selectedAnimalId) {
        settingsToUse = await saveSettings({
          ...nextSettings,
          selectedAnimalId: resolvedSelected,
        })
      }
      setEvents(nextEvents)
      setAnimals(nextAnimals)
      setSettings(settingsToUse)
      setLoadError(null)
    } catch (error) {
      const message =
        error instanceof StorageError ? error.userMessage : STORAGE_LOAD_ERROR
      setLoadError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    void requestPersistentStorage()
  }, [refresh])

  const todaySummary = useMemo(
    () => calculateTodaySummary(events, new Date(), selectedAnimalId),
    [events, selectedAnimalId],
  )
  const recentEvents = useMemo(
    () =>
      events.filter((event) => event.animalId === selectedAnimalId).slice(0, 5),
    [events, selectedAnimalId],
  )

  const updateSettings = useCallback(
    async (partial: Partial<AppSettings>) => {
      const next = await saveSettings({ ...settings, ...partial })
      setSettings(next)
      return next
    },
    [settings],
  )

  const selectAnimal = useCallback(
    async (animalId: string) => {
      if (animalId === settings.selectedAnimalId) return
      const animal = animals.find((item) => item.id === animalId)
      if (!animal || animal.archived || animal.isSystem) return
      await updateSettings({ selectedAnimalId: animalId })
    },
    [animals, settings.selectedAnimalId, updateSettings],
  )

  const log = useCallback(
    async (type: BathroomEventType) => {
      const animalId = settings.selectedAnimalId
      if (!animalId) {
        const message = 'Select an animal before logging.'
        setStatus({ kind: 'error', message })
        setAnnounce(message)
        return null
      }
      if (!debouncer.current.shouldAccept(type, Date.now(), animalId)) {
        return null
      }
      playImpactHaptic(settings.hapticsEnabled)

      const animalName = resolveAnimalName(animals, animalId, 'animal')
      const now = new Date()
      const event: BathroomEvent = {
        id: createId(),
        animalId,
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
        const message = loggedMessage(type, animalName)
        setStatus({ kind: 'success', message, undoId: event.id })
        setAnnounce(message)
        playSuccessHaptic(settings.hapticsEnabled)

        if (shouldShowSafetyNotice(event, nextEvents, settings, now)) {
          setShowSafety(true)
        }
        return event
      } catch (error) {
        const message =
          error instanceof StorageError ? error.userMessage : STORAGE_SAVE_ERROR
        setStatus({ kind: 'error', message, retryType: type })
        setAnnounce(message)
        playErrorHaptic(settings.hapticsEnabled)
        return null
      }
    },
    [animals, events, settings],
  )

  const undo = useCallback(async () => {
    if (!status?.undoId) return
    try {
      const undone = events.find((e) => e.id === status.undoId)
      await deleteEvent(status.undoId)
      setEvents((prev) => prev.filter((e) => e.id !== status.undoId))
      if (undone) debouncer.current.reset(undone.type, undone.animalId)
      setStatus({ kind: 'success', message: 'Entry undone' })
      setAnnounce('Entry undone')
    } catch (error) {
      const message =
        error instanceof StorageError
          ? error.userMessage
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
        const animalName = deleted
          ? resolveAnimalName(animals, deleted.animalId)
          : null
        setStatus({
          kind: 'success',
          message: animalName
            ? `Entry deleted for ${animalName}`
            : 'Entry deleted',
          undoId: deleted?.id,
        })
        setAnnounce(
          animalName ? `Entry deleted for ${animalName}` : 'Entry deleted',
        )
      } catch (error) {
        const message =
          error instanceof StorageError
            ? error.userMessage
            : 'Could not delete that entry.'
        setStatus({ kind: 'error', message })
      }
    },
    [animals, events],
  )

  const undoDeletionOrLast = useCallback(async () => {
    const stashed = deletedForUndo.current
    if (stashed && status?.message.startsWith('Entry deleted')) {
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
            ? error.userMessage
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

  const addAnimal = useCallback(
    async (name: string, color?: string | null) => {
      const error = validateAnimalName(name, animals)
      if (error) throw new Error(error)
      const maxOrder = animals.reduce(
        (max, animal) => Math.max(max, animal.displayOrder ?? 0),
        -1,
      )
      const animal = createAnimalProfile(name, {
        color: color ?? null,
        displayOrder: maxOrder + 1,
      })
      await putAnimal(animal)
      const nextSettings = await saveSettings({
        ...settings,
        selectedAnimalId: animal.id,
      })
      setAnimals((prev) => [...prev, animal])
      setSettings(nextSettings)
      setAnnounce(`${animal.name} added`)
      return animal
    },
    [animals, settings],
  )

  const renameAnimal = useCallback(
    async (animalId: string, name: string) => {
      const animal = animals.find((item) => item.id === animalId)
      if (!animal) throw new Error('Animal not found.')
      if (animal.isSystem) throw new Error('This profile can’t be renamed.')
      const error = validateAnimalName(name, animals, { excludeId: animalId })
      if (error) throw new Error(error)
      const next = {
        ...animal,
        name: normalizeAnimalName(name),
      }
      await putAnimal(next)
      setAnimals((prev) =>
        prev.map((item) => (item.id === animalId ? next : item)),
      )
      return next
    },
    [animals],
  )

  const setAnimalColor = useCallback(
    async (animalId: string, color: string | null) => {
      const animal = animals.find((item) => item.id === animalId)
      if (!animal) throw new Error('Animal not found.')
      const next = { ...animal, color }
      await putAnimal(next)
      setAnimals((prev) =>
        prev.map((item) => (item.id === animalId ? next : item)),
      )
      return next
    },
    [animals],
  )

  const reorderAnimal = useCallback(
    async (animalId: string, direction: 'up' | 'down') => {
      const ordered = [...animals].sort((a, b) => {
        const orderA = a.displayOrder ?? Number.MAX_SAFE_INTEGER
        const orderB = b.displayOrder ?? Number.MAX_SAFE_INTEGER
        if (orderA !== orderB) return orderA - orderB
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      })
      const index = ordered.findIndex((item) => item.id === animalId)
      if (index < 0) return
      const swapWith = direction === 'up' ? index - 1 : index + 1
      if (swapWith < 0 || swapWith >= ordered.length) return
      const current = ordered[index]
      const other = ordered[swapWith]
      if (current.isSystem || other.isSystem) return
      const currentOrder = current.displayOrder ?? index
      const otherOrder = other.displayOrder ?? swapWith
      const nextCurrent = { ...current, displayOrder: otherOrder }
      const nextOther = { ...other, displayOrder: currentOrder }
      await putManyAnimals([nextCurrent, nextOther])
      setAnimals((prev) =>
        prev.map((item) => {
          if (item.id === nextCurrent.id) return nextCurrent
          if (item.id === nextOther.id) return nextOther
          return item
        }),
      )
    },
    [animals],
  )

  const archiveAnimal = useCallback(
    async (animalId: string) => {
      if (!canArchiveAnimal(animals, animalId)) {
        throw new Error('Keep at least one active animal.')
      }
      const animal = animals.find((item) => item.id === animalId)
      if (!animal) throw new Error('Animal not found.')
      const next = { ...animal, archived: true }
      await putAnimal(next)
      const nextAnimals = animals.map((item) =>
        item.id === animalId ? next : item,
      )
      setAnimals(nextAnimals)
      if (settings.selectedAnimalId === animalId) {
        const fallback = nextActiveAnimalId(nextAnimals, null)
        await updateSettings({ selectedAnimalId: fallback })
      }
    },
    [animals, settings.selectedAnimalId, updateSettings],
  )

  const restoreAnimal = useCallback(
    async (animalId: string) => {
      const animal = animals.find((item) => item.id === animalId)
      if (!animal) throw new Error('Animal not found.')
      if (animal.isSystem) {
        throw new Error('System profiles stay in History only.')
      }
      const next = { ...animal, archived: false }
      await putAnimal(next)
      setAnimals((prev) =>
        prev.map((item) => (item.id === animalId ? next : item)),
      )
    },
    [animals],
  )

  const importBackupText = useCallback(
    async (text: string) => {
      const backup = parseBackup(JSON.parse(text) as unknown)
      const animalMerge = mergeBackupAnimals(animals, backup.animals)
      const { merged, imported, skippedDuplicates } = mergeBackupEvents(
        events,
        backup.events,
      )
      await putManyAnimals(animalMerge.merged)
      await putManyEvents(merged)
      const nextSettings = await saveSettings({
        ...settings,
        ...backup.settings,
        installPromptDismissed: settings.installPromptDismissed,
        backupReminderDismissed: settings.backupReminderDismissed,
        lastBackupAt: settings.lastBackupAt,
        vetPhoneNumber:
          backup.settings.vetPhoneNumber || settings.vetPhoneNumber,
        selectedAnimalId: nextActiveAnimalId(
          animalMerge.merged,
          backup.settings.selectedAnimalId ?? settings.selectedAnimalId,
        ),
      })
      setAnimals(animalMerge.merged)
      setEvents(merged)
      setSettings(nextSettings)
      return {
        imported,
        skippedDuplicates,
        animalsImported: animalMerge.imported,
      }
    },
    [animals, events, settings],
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
    () => createBackup(events, settings, animals),
    [animals, events, settings],
  )

  const retryStorage = useCallback(async () => {
    setLoading(true)
    try {
      await recoverStorage()
      await refresh()
      setStatus(null)
    } catch (error) {
      const message =
        error instanceof StorageError ? error.userMessage : STORAGE_LOAD_ERROR
      setLoadError(message)
    } finally {
      setLoading(false)
    }
  }, [refresh])

  const runStorageProbe = useCallback(async () => {
    return probeIndexedDBOpen()
  }, [])

  const resetLocalStorage = useCallback(async () => {
    await resetLocalLitterLogStorage()
    setEvents([])
    setAnimals([])
    setSettings(DEFAULT_SETTINGS)
    setLoadError(null)
    setStatus(null)
    setLoading(true)
    await refresh()
  }, [refresh])

  const canLog = Boolean(selectedAnimalId) && !loadError

  return {
    events,
    animals,
    selectableAnimals,
    selectedAnimal,
    selectedAnimalId,
    settings,
    screen,
    setScreen,
    loading,
    loadError,
    technicalStorageError: getLastTechnicalStorageError(),
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
    retryStorage,
    runStorageProbe,
    resetLocalStorage,
    canLog,
    log,
    selectAnimal,
    undo: undoDeletionOrLast,
    remove,
    saveEditor,
    updateSettings,
    clearHistory,
    importBackupText,
    markBackupExported,
    dismissSafety,
    buildBackup,
    addAnimal,
    renameAnimal,
    setAnimalColor,
    reorderAnimal,
    archiveAnimal,
    restoreAnimal,
  }
}

export type LitterLogState = ReturnType<typeof useLitterLog>
