import {
  dueSlot,
  isDigestDue,
  localDayAndHour,
  type DigestSchedule,
} from './schedule.js';

// Monday 2025-09-01 07:30 UTC
const MONDAY_0730_UTC = new Date('2025-09-01T07:30:00Z');

describe('localDayAndHour', () => {
  it('converts to the user timezone', () => {
    expect(localDayAndHour(MONDAY_0730_UTC, 'UTC')).toMatchObject({
      day: 1,
      hour: 7,
    });
    expect(localDayAndHour(MONDAY_0730_UTC, 'Africa/Lagos')).toMatchObject({
      day: 1,
      hour: 8,
    });
    // Still Sunday evening in Hawaii (UTC-10)
    expect(localDayAndHour(MONDAY_0730_UTC, 'Pacific/Honolulu')).toMatchObject({
      day: 0,
      hour: 21,
    });
    expect(localDayAndHour(MONDAY_0730_UTC, 'Asia/Kolkata')).toMatchObject({
      day: 1,
      hour: 13,
    });
  });

  it('uses 0 rather than 24 for midnight', () => {
    expect(
      localDayAndHour(new Date('2025-09-01T00:10:00Z'), 'UTC'),
    ).toMatchObject({
      day: 1,
      hour: 0,
    });
  });
});

describe('isDigestDue', () => {
  const user: DigestSchedule = {
    digestFrequency: 'WEEKLY',
    digestDay: 1,
    digestHour: 8,
    timezone: 'Africa/Lagos',
    lastDigestSentAt: null,
  };

  it('is due in the chosen local hour', () => {
    expect(isDigestDue(user, MONDAY_0730_UTC)).toBe(true);
  });

  it('is not due in other hours or days', () => {
    expect(isDigestDue({ ...user, digestHour: 9 }, MONDAY_0730_UTC)).toBe(
      false,
    );
    expect(isDigestDue({ ...user, digestDay: 2 }, MONDAY_0730_UTC)).toBe(false);
  });

  it('is not due twice for the same week', () => {
    const sent = new Date(MONDAY_0730_UTC.getTime() - 60 * 60_000);
    expect(
      isDigestDue({ ...user, lastDigestSentAt: sent }, MONDAY_0730_UTC),
    ).toBe(false);
    const lastWeek = new Date(MONDAY_0730_UTC.getTime() - 7 * 24 * 60 * 60_000);
    expect(
      isDigestDue({ ...user, lastDigestSentAt: lastWeek }, MONDAY_0730_UTC),
    ).toBe(true);
  });

  it('falls back to UTC for an unknown timezone', () => {
    expect(
      isDigestDue(
        { ...user, timezone: 'Not/AZone', digestHour: 7 },
        MONDAY_0730_UTC,
      ),
    ).toBe(true);
  });

  const DAY = 24 * 60 * 60_000;
  const daysBefore = (n: number) =>
    new Date(MONDAY_0730_UTC.getTime() - n * DAY);

  it('sends daily at the chosen hour, whatever the day', () => {
    const daily = { ...user, digestFrequency: 'DAILY' as const, digestDay: 4 };
    expect(isDigestDue(daily, MONDAY_0730_UTC)).toBe(true);
    expect(
      isDigestDue(
        { ...daily, lastDigestSentAt: daysBefore(1) },
        MONDAY_0730_UTC,
      ),
    ).toBe(true);
    expect(
      isDigestDue(
        {
          ...daily,
          lastDigestSentAt: new Date(MONDAY_0730_UTC.getTime() - 60 * 60_000),
        },
        MONDAY_0730_UTC,
      ),
    ).toBe(false);
  });

  it('skips the in-between week when fortnightly', () => {
    const fortnightly = { ...user, digestFrequency: 'FORTNIGHTLY' as const };
    expect(
      isDigestDue(
        { ...fortnightly, lastDigestSentAt: daysBefore(7) },
        MONDAY_0730_UTC,
      ),
    ).toBe(false);
    expect(
      isDigestDue(
        { ...fortnightly, lastDigestSentAt: daysBefore(14) },
        MONDAY_0730_UTC,
      ),
    ).toBe(true);
  });

  it('sends monthly on the first chosen weekday of the month', () => {
    const monthly = { ...user, digestFrequency: 'MONTHLY' as const };
    // 2025-09-01 is the first Monday of September.
    expect(isDigestDue(monthly, MONDAY_0730_UTC)).toBe(true);
    // 2025-09-08 is the second Monday.
    expect(isDigestDue(monthly, new Date('2025-09-08T07:30:00Z'))).toBe(false);
    // First Monday of October, a month after the last issue.
    expect(
      isDigestDue(
        { ...monthly, lastDigestSentAt: MONDAY_0730_UTC },
        new Date('2025-10-06T07:30:00Z'),
      ),
    ).toBe(true);
  });
});

describe('catching up on missed issues', () => {
  // Monday 2025-09-01 08:00 in Lagos (UTC+1) is 07:00 UTC.
  const SLOT = new Date('2025-09-01T07:00:00Z');
  const HOUR = 60 * 60_000;
  const later = (hours: number) => new Date(SLOT.getTime() + hours * HOUR);
  const weekly: DigestSchedule = {
    digestFrequency: 'WEEKLY',
    digestDay: 1,
    digestHour: 8,
    timezone: 'Africa/Lagos',
    lastDigestSentAt: new Date('2025-08-25T07:05:00Z'),
  };

  it('sends a missed issue late, for up to a day', () => {
    expect(dueSlot(weekly, later(3))).toEqual(SLOT);
    expect(dueSlot(weekly, later(23.5))).toEqual(SLOT);
    expect(dueSlot(weekly, later(25))).toBeNull();
  });

  it('does not resend an issue that already went out', () => {
    const served = { ...weekly, lastDigestSentAt: later(0.1) };
    expect(dueSlot(served, later(3))).toBeNull();
  });

  it('keeps the next issue on time after a late one', () => {
    const lateLastWeek = {
      ...weekly,
      lastDigestSentAt: new Date('2025-08-26T06:30:00Z'), // 23.5h late
    };
    expect(dueSlot(lateLastWeek, later(0.1))).toEqual(SLOT);
  });

  it('gives daily issues a shorter window', () => {
    const daily = {
      ...weekly,
      digestFrequency: 'DAILY' as const,
      lastDigestSentAt: later(-24),
    };
    expect(dueSlot(daily, later(5))).toEqual(SLOT);
    expect(dueSlot(daily, later(7))).toBeNull();
  });

  it('still skips the in-between week when fortnightly', () => {
    const fortnightly = {
      ...weekly,
      digestFrequency: 'FORTNIGHTLY' as const,
      lastDigestSentAt: new Date('2025-08-26T06:30:00Z'), // late, a week ago
    };
    expect(dueSlot(fortnightly, later(1))).toBeNull();
    const twoWeeksAgo = {
      ...fortnightly,
      lastDigestSentAt: new Date('2025-08-19T06:30:00Z'), // late, two weeks ago
    };
    expect(dueSlot(twoWeeksAgo, later(1))).toEqual(SLOT);
  });

  it('finds half-hour-offset slots', () => {
    // 13:00 in Kolkata (UTC+5:30) is 07:30 UTC.
    const kolkata = { ...weekly, timezone: 'Asia/Kolkata', digestHour: 13 };
    expect(isDigestDue(kolkata, new Date('2025-09-01T09:00:00Z'))).toBe(true);
    expect(dueSlot(kolkata, new Date('2025-09-01T09:00:00Z'))).toEqual(
      new Date('2025-09-01T07:30:00Z'),
    );
  });
});
