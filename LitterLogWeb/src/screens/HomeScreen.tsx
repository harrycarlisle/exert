import { LogButton } from '../components/LogButton'
import { EventRow } from '../components/EventRow'
import { GearIcon, HistoryIcon } from '../components/Icons'
import { formatFullDate, formatTime, parseISO } from '../lib/dates'
import { formatTodaySummary } from '../lib/summary'
import type { LitterLogState } from '../state/useLitterLog'
import type { BathroomEvent } from '../models/types'

interface Props {
  state: LitterLogState
  onDeleteRequest: (event: BathroomEvent) => void
}

export function HomeScreen({ state, onDeleteRequest }: Props) {
  const {
    settings,
    todaySummary,
    recentEvents,
    loadError,
    setScreen,
    log,
    setEditorMode,
    setEditorEvent,
  } = state

  const todayLabel = formatFullDate(new Date())
  const subtitle = settings.catName.trim()
    ? `${settings.catName.trim()} · ${todayLabel}`
    : todayLabel

  return (
    <section>
      <header className="topbar">
        <div>
          <h1>Litter Log</h1>
          <p className="subtitle">{subtitle}</p>
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

      <div className="logging">
        <div className="logging-row">
          <LogButton type="pee" onLog={log} />
          <LogButton type="poo" onLog={log} />
        </div>
        <LogButton type="triedToPee" onLog={log} compact />
      </div>

      <div className="card" aria-live="polite">
        <p className="summary-title">{formatTodaySummary(todaySummary)}</p>
        {todaySummary.mostRecentTimestamp ? (
          <p className="summary-meta">
            Latest at {formatTime(parseISO(todaySummary.mostRecentTimestamp))}
          </p>
        ) : (
          <p className="summary-meta">Nothing recorded today</p>
        )}
        {loadError ? <p className="summary-meta">{loadError}</p> : null}
      </div>

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

      {recentEvents.length === 0 ? (
        <div className="card empty">
          Tap Pee, Poo, or Tried to Pee to start logging.
        </div>
      ) : (
        <div className="card">
          <ul className="event-list">
            {recentEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                onEdit={(item) => {
                  setEditorEvent(item)
                  setEditorMode('edit')
                }}
                onDelete={onDeleteRequest}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
