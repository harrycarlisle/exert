import type { BathroomEvent, TodaySummary } from '../models/types'
import { isSameLocalDay, parseISO } from './dates'

export function pluralize(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function formatTodaySummary(
  summary: TodaySummary,
  prefix = 'Today',
): string {
  const pee = pluralize(summary.peeCount, 'pee', 'pees')
  const poo = pluralize(summary.pooCount, 'poo', 'poos')
  const tried = pluralize(summary.triedCount, 'attempt', 'attempts')
  return `${prefix}: ${pee} · ${poo} · ${tried}`
}

export function calculateTodaySummary(
  events: BathroomEvent[],
  now = new Date(),
  animalId?: string | null,
): TodaySummary {
  let peeCount = 0
  let pooCount = 0
  let triedCount = 0
  let mostRecentTimestamp: string | null = null
  let mostRecentMs = -1

  for (const event of events) {
    if (animalId && event.animalId !== animalId) continue
    const date = parseISO(event.timestamp)
    if (!isSameLocalDay(date, now)) continue
    if (event.type === 'pee') peeCount += 1
    if (event.type === 'poo') pooCount += 1
    if (event.type === 'triedToPee') triedCount += 1
    const ms = date.getTime()
    if (ms > mostRecentMs) {
      mostRecentMs = ms
      mostRecentTimestamp = event.timestamp
    }
  }

  return { peeCount, pooCount, triedCount, mostRecentTimestamp }
}
