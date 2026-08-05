import { useState } from 'react'
import { AddAnimalSheet } from '../components/AddAnimalSheet'
import { AnimalSelector } from '../components/AnimalSelector'
import { LogButton } from '../components/LogButton'
import { EventRow } from '../components/EventRow'
import { GearIcon, HistoryIcon } from '../components/Icons'
import { formatFullDate, formatTime, parseISO } from '../lib/dates'
import { resolveAnimalName } from '../lib/animals'
import { formatTodaySummary } from '../lib/summary'
import type { LitterLogState } from '../state/useLitterLog'
import type { BathroomEvent } from '../models/types'

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

  const todayLabel = formatFullDate(new Date())
  const animalName = selectedAnimal?.name ?? 'Animal'
  const summaryPrefix = `${animalName} today`
  const hasAnimals = selectableAnimals.length > 0

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

      {loadError ? (
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

      {!loadError && hasAnimals ? (
        <AnimalSelector
          animals={selectableAnimals}
          selectedId={selectedAnimalId}
          onSelect={(id) => void selectAnimal(id)}
          onAddAnimal={() => setShowAddAnimal(true)}
        />
      ) : null}

      {!loadError && !hasAnimals ? (
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

      {hasAnimals ? (
        <div className="logging">
          <div className="logging-row">
            <LogButton type="pee" onLog={log} disabled={!canLog} />
            <LogButton type="poo" onLog={log} disabled={!canLog} />
          </div>
          <LogButton type="triedToPee" onLog={log} compact disabled={!canLog} />
        </div>
      ) : null}

      {hasAnimals ? (
        <div className="card summary-card" aria-live="polite">
          <p className="summary-title">
            {formatTodaySummary(todaySummary, summaryPrefix)}
          </p>
          {todaySummary.mostRecentTimestamp ? (
            <p className="summary-meta">
              Latest at {formatTime(parseISO(todaySummary.mostRecentTimestamp))}
            </p>
          ) : (
            <p className="summary-meta">Nothing recorded today</p>
          )}
        </div>
      ) : null}

      {recentEvents.length > 0 ? (
        <>
          <div className="section-head">
            <h2>Recent</h2>
            <button
              type="button"
              className="text-btn"
              onClick={() => setScreen('history')}
            >
              View All History
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
