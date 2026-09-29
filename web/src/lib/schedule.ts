// Mirrors the API's src/digest/schedule.ts so the UI can say when the next
// issue arrives without asking the server.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const MIN_GAP_MS = 6 * 24 * 60 * 60_000
const STEP_MS = 15 * 60_000
const formatters = new Map<string, Intl.DateTimeFormat>()

export interface DeliverySchedule {
  digestEnabled: boolean
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
    hour: Number(get('hour')),
    minute: Number(get('minute')),
  }
}

/** The next moment the scheduler will pick this user up, or null if paused. */
export function nextIssueAt(user: DeliverySchedule, now = new Date()): Date | null {
  if (!user.digestEnabled) return null
  const earliest = user.lastDigestSentAt
    ? new Date(user.lastDigestSentAt).getTime() + MIN_GAP_MS
    : 0
  const timeZone = isValidTimeZone(user.timezone) ? user.timezone : 'UTC'

  let t = Math.ceil(now.getTime() / STEP_MS) * STEP_MS
  // Two weeks of quarter hours covers every offset and the six-day gap.
  for (let i = 0; i < 14 * 24 * 4; i++, t += STEP_MS) {
    if (t < earliest) continue
    const local = localParts(new Date(t), timeZone)
    if (local.day === user.digestDay && local.hour === user.digestHour && local.minute === 0) {
      return new Date(t)
    }
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
