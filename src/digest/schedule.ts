const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

export type DigestFrequency = 'DAILY' | 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY';

/**
 * Minimum time between two digests at each frequency. It guards against
 * double sends and, for FORTNIGHTLY, skips the in-between week.
 */
export const MIN_GAP_MS: Record<DigestFrequency, number> = {
  DAILY: 20 * HOUR_MS,
  WEEKLY: 6 * DAY_MS,
  FORTNIGHTLY: 13 * DAY_MS,
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

/**
 * Day of week (0 = Sunday), hour (0-23) and day of the month of `date` in
 * `timeZone`.
 */
export function localDayAndHour(
  date: Date,
  timeZone: string,
): { day: number; hour: number; date: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: WEEKDAYS.indexOf(get('weekday')),
    hour: Number(get('hour')),
    date: Number(get('day')),
  };
}

/**
 * True during the user's chosen local hour on a delivery day, unless a digest
 * went out too recently for their frequency. The scheduler runs several times
 * per hour, so a short outage doesn't skip anyone's issue.
 *
 * - DAILY: every day
 * - WEEKLY: every digestDay
 * - FORTNIGHTLY: every other digestDay
 * - MONTHLY: the first digestDay of the month
 */
export function isDigestDue(user: DigestSchedule, now: Date): boolean {
  let local: { day: number; hour: number; date: number };
  try {
    local = localDayAndHour(now, user.timezone);
  } catch {
    local = localDayAndHour(now, 'UTC');
  }
  if (local.hour !== user.digestHour) return false;
  if (user.digestFrequency !== 'DAILY' && local.day !== user.digestDay) {
    return false;
  }
  if (user.digestFrequency === 'MONTHLY' && local.date > 7) return false;
  return (
    !user.lastDigestSentAt ||
    now.getTime() - user.lastDigestSentAt.getTime() >=
      MIN_GAP_MS[user.digestFrequency]
  );
}
