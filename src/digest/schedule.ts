const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Guards against double sends; also the minimum time between two digests. */
export const MIN_DIGEST_GAP_MS = 6 * 24 * 60 * 60_000;

export interface DigestSchedule {
  digestDay: number;
  digestHour: number;
  timezone: string;
  lastDigestSentAt: Date | null;
}

/** Day of week (0 = Sunday) and hour (0-23) of `date` in `timeZone`. */
export function localDayAndHour(
  date: Date,
  timeZone: string,
): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return { day: WEEKDAYS.indexOf(weekday), hour };
}

/**
 * True during the user's chosen local hour, unless a digest already went out
 * in the last six days. The scheduler runs several times per hour, so a
 * short outage doesn't skip anyone's week.
 */
export function isDigestDue(user: DigestSchedule, now: Date): boolean {
  let local: { day: number; hour: number };
  try {
    local = localDayAndHour(now, user.timezone);
  } catch {
    local = localDayAndHour(now, 'UTC');
  }
  if (local.day !== user.digestDay || local.hour !== user.digestHour) {
    return false;
  }
  return (
    !user.lastDigestSentAt ||
    now.getTime() - user.lastDigestSentAt.getTime() >= MIN_DIGEST_GAP_MS
  );
}
