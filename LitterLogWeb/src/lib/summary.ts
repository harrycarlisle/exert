import type { BathroomEvent, TodaySummary } from '../models/types'
import { isSameLocalDay, parseISO } from './dates'

export function pluralize(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatTodayHeading(animalName: string): string {
  return `Today · ${animalName}`
}

export function formatTodayStat(
  count: number,
  singular: string,
  plural: string,
): string {
  return pluralize(count, singular, plural)
}

/** Accessible full-sentence summary for live regions and screen readers. */
export function formatTodaySummary(
  summary: TodaySummary,
  animalName = 'Today',
): string {
  const heading = animalName.startsWith('Today')
    ? animalName
    : formatTodayHeading(animalName)
  const pee = formatTodayStat(summary.peeCount, 'Pee', 'Pees')
  const poo = formatTodayStat(summary.pooCount, 'Poo', 'Poos')
  const vomit = formatTodayStat(summary.vomitCount, 'Vomit', 'Vomits')
  const hairball = formatTodayStat(
    summary.hairballCount,
    'Hairball',
    'Hairballs',
  )
  const tried = formatTodayStat(summary.triedCount, 'Tried', 'Tried')
  return `${heading}: ${pee} · ${poo} · ${vomit} · ${hairball} · ${tried}`
}

export function calculateTodaySummary(
  events: BathroomEvent[],
  now = new Date(),
  animalId?: string | null,
): TodaySummary {
  let peeCount = 0
  let pooCount = 0
  let vomitCount = 0
  let hairballCount = 0
  let triedCount = 0
  let mostRecentTimestamp: string | null = null
  let mostRecentMs = -1

  for (const event of events) {
    if (animalId && event.animalId !== animalId) continue
    const date = parseISO(event.timestamp)
    if (!isSameLocalDay(date, now)) continue
    if (event.type === 'pee') peeCount += 1
    if (event.type === 'poo') pooCount += 1
    if (event.type === 'vomit') vomitCount += 1
    if (event.type === 'hairball') hairballCount += 1
    if (event.type === 'triedToPee') triedCount += 1
    const ms = date.getTime()
    if (ms > mostRecentMs) {
      mostRecentMs = ms
      mostRecentTimestamp = event.timestamp
    }
  }

  return {
    peeCount,
    pooCount,
    vomitCount,
    hairballCount,
    triedCount,
    mostRecentTimestamp,
  }
}
