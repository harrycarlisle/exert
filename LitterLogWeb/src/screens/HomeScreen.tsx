import { useEffect, useId, useRef, useState } from 'react'
import { AddAnimalSheet } from '../components/AddAnimalSheet'
import { AnimalSelector } from '../components/AnimalSelector'
import { LogButton } from '../components/LogButton'
import { EventRow } from '../components/EventRow'
import { VomitDetailPopover } from '../components/VomitDetailPopover'
import { ChevronIcon, GearIcon, HistoryIcon } from '../components/Icons'
import { formatFullDate, formatTime, parseISO } from '../lib/dates'
import { resolveAnimalName } from '../lib/animals'
import {
  formatTodayHeading,
  formatTodayStat,
  formatTodaySummary,
} from '../lib/summary'
import type { LitterLogState } from '../state/useLitterLog'
import type { BathroomEvent } from '../models/types'

const MORE_LOGGING_SESSION_KEY = 'litter-log:more-logging-open'

function readMoreLoggingOpen(): boolean {
  try {
    return sessionStorage.getItem(MORE_LOGGING_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

function writeMoreLoggingOpen(open: boolean): void {
  try {
    sessionStorage.setItem(MORE_LOGGING_SESSION_KEY, open ? '1' : '0')
  } catch {
    // Session memory is best-effort only.
  }
}

interface Props {
  state: LitterLogState
  onDeleteRequest: (event: BathroomEvent) => void
}

export function HomeScreen({ state, onDeleteRequest }: Props) {
  const {
    selectableAnimals,
    selectedAnimal,
    selectedAnimalId,
    todaySummary,
    recentEvents,
    animals,
    loading,
    loadError,
    canLog,
    setScreen,
    log,
    selectAnimal,
    retryStorage,
    addAnimal,
    setStatus,
    setEditorMode,
    setEditorEvent,
  } = state
  const [showAddAnimal, setShowAddAnimal] = useState(false)
  const [moreLoggingOpen, setMoreLoggingOpen] = useState(false)
  const [vomitOpen, setVomitOpen] = useState(false)
  const moreLoggingPanelId = useId()
  const vomitButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMoreLoggingOpen(readMoreLoggingOpen())
  }, [])

  const todayLabel = formatFullDate(new Date())
  const animalName = selectedAnimal?.name ?? 'Animal'
  const hasAnimals = selectableAnimals.length > 0
  const showLiveData = !loading && !loadError
  const summaryHeading = formatTodayHeading(animalName)
  const summaryAnnouncement = formatTodaySummary(todaySummary, animalName)

  function toggleMoreLogging() {
    setMoreLoggingOpen((current) => {
      const next = !current
      writeMoreLoggingOpen(next)
      return next
    })
  }

  function closeVomitPopover() {
    setVomitOpen(false)
    window.setTimeout(() => {
      vomitButtonRef.current?.focus()
    }, 0)
  }

  return (
    <section className="home-screen">
      <header className="topbar">
        <div>
          <h1>Litter Log</h1>
          <p className="subtitle">{todayLabel}</p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label="History"
            onClick={() => setScreen('history')}
          >
            <HistoryIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Settings"
            onClick={() => setScreen('settings')}
          >
            <GearIcon />
          </button>
        </div>
      </header>

      {loading ? (
        <div className="data-loading" aria-busy="true" aria-live="polite">
          <p className="muted">Loading…</p>
        </div>
      ) : null}

      {!loading && loadError ? (
        <div className="storage-notice" role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void retryStorage()}
          >
            Try again
          </button>
        </div>
      ) : null}

      {showLiveData && hasAnimals ? (
        <AnimalSelector
          animals={selectableAnimals}
          selectedId={selectedAnimalId}
          onSelect={(id) => void selectAnimal(id)}
          onAddAnimal={() => setShowAddAnimal(true)}
        />
      ) : null}

      {showLiveData && !hasAnimals ? (
        <div className="empty-animals">
          <p>Add an animal to start logging.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowAddAnimal(true)}
          >
            Add your first animal
          </button>
        </div>
      ) : null}

      {showLiveData && hasAnimals ? (
        <div className="logging">
          <div className="logging-grid" data-testid="main-logging-grid">
            <LogButton type="pee" onLog={log} disabled={!canLog} />
            <LogButton type="poo" onLog={log} disabled={!canLog} />
            <LogButton
              ref={vomitButtonRef}
              type="vomit"
              disabled={!canLog}
              onClick={() => setVomitOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={vomitOpen}
            />
            <LogButton type="hairball" onLog={log} disabled={!canLog} />
          </div>
          <button
            type="button"
            className="more-logging-toggle"
            aria-expanded={moreLoggingOpen}
            aria-controls={moreLoggingPanelId}
            onClick={toggleMoreLogging}
          >
            <span>More logging options</span>
            <ChevronIcon direction={moreLoggingOpen ? 'up' : 'down'} />
          </button>
          <div
            id={moreLoggingPanelId}
            className={`more-logging-panel${moreLoggingOpen ? ' open' : ''}`}
            hidden={!moreLoggingOpen}
          >
            {moreLoggingOpen ? (
              <LogButton
                type="triedToPee"
                onLog={log}
                compact
                disabled={!canLog}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <VomitDetailPopover
        open={vomitOpen}
        anchorRef={vomitButtonRef}
        disabled={!canLog}
        onClose={closeVomitPopover}
        onLog={async (note) => {
          const saved = await log('vomit', note)
          if (saved) closeVomitPopover()
        }}
      />

      {showLiveData && hasAnimals ? (
        <div className="card summary-card">
          <p className="summary-title">{summaryHeading}</p>
          <div
            className="today-stats"
            aria-label={summaryAnnouncement}
            data-testid="today-stats"
          >
            <span
              className={`today-stat${todaySummary.peeCount === 0 ? ' zero' : ''}`}
            >
              {formatTodayStat(todaySummary.peeCount, 'Pee', 'Pees')}
            </span>
            <span
              className={`today-stat${todaySummary.pooCount === 0 ? ' zero' : ''}`}
            >
              {formatTodayStat(todaySummary.pooCount, 'Poo', 'Poos')}
            </span>
            <span
              className={`today-stat${todaySummary.vomitCount === 0 ? ' zero' : ''}`}
            >
              {formatTodayStat(todaySummary.vomitCount, 'Vomit', 'Vomits')}
            </span>
            <span
              className={`today-stat${todaySummary.hairballCount === 0 ? ' zero' : ''}`}
            >
              {formatTodayStat(
                todaySummary.hairballCount,
                'Hairball',
                'Hairballs',
              )}
            </span>
            <span
              className={`today-stat${todaySummary.triedCount === 0 ? ' zero' : ''}`}
            >
              {formatTodayStat(todaySummary.triedCount, 'Tried', 'Tried')}
            </span>
          </div>
          {todaySummary.mostRecentTimestamp ? (
            <p className="summary-meta">
              Latest at {formatTime(parseISO(todaySummary.mostRecentTimestamp))}
            </p>
          ) : (
            <p className="summary-meta">Nothing recorded today</p>
          )}
        </div>
      ) : null}

      {showLiveData && recentEvents.length > 0 ? (
        <>
          <div className="section-head">
            <h2>Recent</h2>
            <button
              type="button"
              className="history-link"
              onClick={() => setScreen('history')}
            >
              <span>View All History</span>
              <ChevronIcon direction="right" />
            </button>
          </div>
          <div className="card recent-card">
            <ul className="event-list">
              {recentEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  animalName={resolveAnimalName(animals, event.animalId)}
                  onEdit={(item) => {
                    setEditorEvent(item)
                    setEditorMode('edit')
                  }}
                  onDelete={onDeleteRequest}
                />
              ))}
            </ul>
          </div>
        </>
      ) : null}

      {showAddAnimal ? (
        <AddAnimalSheet
          onCancel={() => setShowAddAnimal(false)}
          onAdd={async (name, color) => {
            const animal = await addAnimal(name, color)
            setShowAddAnimal(false)
            setStatus({
              kind: 'success',
              message: `${animal.name} added`,
            })
          }}
        />
      ) : null}
    </section>
  )
}
