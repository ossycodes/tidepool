// Mirrors the API's src/digest/schedule.ts so the UI can say when the next
// issue arrives without asking the server.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

import type { DigestFrequency } from '@/lib/api'

const HOUR_MS = 60 * 60_000
const DAY_MS = 24 * HOUR_MS
/**
 * Same gaps as the API (src/digest/schedule.ts): the minimum time between two
 * issues, kept short enough that an issue sent late doesn't delay the next.
 */
const MIN_GAP_MS: Record<DigestFrequency, number> = {
  DAILY: 12 * HOUR_MS,
  WEEKLY: 5 * DAY_MS,
  FORTNIGHTLY: 12 * DAY_MS,
  MONTHLY: 20 * DAY_MS,
}
/** How far ahead to look: enough to cover the gap plus a full cycle. */
const HORIZON_DAYS: Record<DigestFrequency, number> = {
  DAILY: 3,
  WEEKLY: 14,
  FORTNIGHTLY: 21,
  MONTHLY: 70,
}
const STEP_MS = 15 * 60_000
const formatters = new Map<string, Intl.DateTimeFormat>()

export interface DeliverySchedule {
  digestEnabled: boolean
  digestFrequency: DigestFrequency
  digestDay: number
  digestHour: number
  timezone: string
  lastDigestSentAt: string | null
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, formatter)
  }
  return formatter
}

export function localParts(date: Date, timeZone: string) {
  const parts = formatterFor(timeZone).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    day: WEEKDAYS.indexOf(get('weekday')),
    /** Day of the month */
    date: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  }
}

/** The next moment the scheduler will pick this user up, or null if paused. */
export function nextIssueAt(user: DeliverySchedule, now = new Date()): Date | null {
  if (!user.digestEnabled) return null
  const frequency = user.digestFrequency ?? 'WEEKLY'
  const earliest = user.lastDigestSentAt
    ? new Date(user.lastDigestSentAt).getTime() + MIN_GAP_MS[frequency]
    : 0
  const timeZone = isValidTimeZone(user.timezone) ? user.timezone : 'UTC'

  // Quarter hours, so zones with :30 and :45 offsets land on the hour too.
  let t = Math.ceil(Math.max(now.getTime(), earliest) / STEP_MS) * STEP_MS
  const steps = (HORIZON_DAYS[frequency] * DAY_MS) / STEP_MS
  for (let i = 0; i < steps; i++, t += STEP_MS) {
    const local = localParts(new Date(t), timeZone)
    if (local.hour !== user.digestHour || local.minute !== 0) continue
    if (frequency !== 'DAILY' && local.day !== user.digestDay) continue
    if (frequency === 'MONTHLY' && local.date > 7) continue
    return new Date(t)
  }
  return null
}

/** "Monday, 8:00 AM" in the given timezone. */
export function issueTimeLabel(date: Date, timeZone: string): string {
  return date.toLocaleString('en-US', {
    weekday: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
}

/** "8:00 AM" for an hour of the day. */
export function hourLabel(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}:00 ${suffix}`
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}
