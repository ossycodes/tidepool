const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type DigestFrequency = 'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';

/**
 * How late a missed issue may still go out, e.g. after the server was down
 * for the reader's whole delivery hour. Daily is shorter so a late issue
 * doesn't crowd the next one.
 */
export const CATCH_UP_MS: Record<DigestFrequency, number> = {
  DAILY: 6 * HOUR_MS,
  WEEKLY: DAY_MS,
  FORTNIGHTLY: DAY_MS,
  MONTHLY: DAY_MS,
};

/**
 * Minimum time between two issues. It guards against double sends and, for
 * FORTNIGHTLY, skips the week in between. Each is a little under the cycle
 * minus the catch-up window, so an issue sent late never pushes the next
 * on-time issue back.
 */
export const MIN_GAP_MS: Record<DigestFrequency, number> = {
  DAILY: 12 * HOUR_MS,
  WEEKLY: 5 * DAY_MS,
  FORTNIGHTLY: 12 * DAY_MS,
  MONTHLY: 20 * DAY_MS,
};

/** The shortest gap of any frequency, for prefiltering users in queries. */
export const SHORTEST_GAP_MS = Math.min(...Object.values(MIN_GAP_MS));

export interface DigestSchedule {
  digestFrequency: DigestFrequency;
  digestDay: number;
  digestHour: number;
  timezone: string;
  lastDigestSentAt: Date | null;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/**
 * Day of week (0 = Sunday), hour (0-23), minute and day of the month of
 * `date` in `timeZone`.
 */
export function localDayAndHour(
  date: Date,
  timeZone: string,
): { day: number; hour: number; minute: number; date: number } {
  const parts = formatterFor(timeZone).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: WEEKDAYS.indexOf(get('weekday')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    date: Number(get('day')),
  };
}

function safeTimeZone(timeZone: string): string {
  try {
    formatterFor(timeZone);
    return timeZone;
  } catch {
    return 'UTC';
  }
}

/**
 * The most recent scheduled delivery at or before `now` (within the last
 * day), or null if the last occurrence of the delivery hour wasn't a
 * delivery day.
 *
 * - DAILY: every day
 * - WEEKLY and FORTNIGHTLY: every digestDay (the gap skips alternate weeks)
 * - MONTHLY: the first digestDay of the month
 */
export function latestSlot(user: DigestSchedule, now: Date): Date | null {
  const timeZone = safeTimeZone(user.timezone);
  const local = localDayAndHour(now, timeZone);
  const hoursSince = (local.hour - user.digestHour + 24) % 24;
  const minuteStart = Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS;
  const slot = new Date(
    minuteStart - local.minute * MINUTE_MS - hoursSince * HOUR_MS,
  );

  const at = localDayAndHour(slot, timeZone);
  // Daylight-saving shifts can make the hour not exist that day.
  if (at.hour !== user.digestHour) return null;
  if (user.digestFrequency !== 'DAILY' && at.day !== user.digestDay) {
    return null;
  }
  if (user.digestFrequency === 'MONTHLY' && at.date > 7) return null;
  return slot;
}

/**
 * The delivery slot to send now: the reader's latest slot, if it hasn't been
 * served yet and is recent enough to catch up on. The scheduler runs every
 * 15 minutes, so an issue goes out at its hour, or as soon as possible after
 * an outage.
 */
export function dueSlot(user: DigestSchedule, now: Date): Date | null {
  const slot = latestSlot(user, now);
  if (!slot) return null;
  if (now.getTime() - slot.getTime() >= CATCH_UP_MS[user.digestFrequency]) {
    return null;
  }
  const last = user.lastDigestSentAt;
  const served =
    last &&
    (last >= slot ||
      now.getTime() - last.getTime() < MIN_GAP_MS[user.digestFrequency]);
  return served ? null : slot;
}

export function isDigestDue(user: DigestSchedule, now: Date): boolean {
  return dueSlot(user, now) !== null;
}
