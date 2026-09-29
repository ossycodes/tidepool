import { describe, expect, it } from 'vitest'
import { hourLabel, issueTimeLabel, nextIssueAt } from '@/lib/schedule'

// Monday 2025-09-01 06:10 UTC = 07:10 in Lagos (UTC+1)
const MONDAY_0610_UTC = new Date('2025-09-01T06:10:00Z')

const lagosMonday8 = {
  digestEnabled: true,
  digestDay: 1,
  digestHour: 8,
  timezone: 'Africa/Lagos',
  lastDigestSentAt: null,
}

describe('nextIssueAt', () => {
  it('finds the next local delivery slot', () => {
    expect(nextIssueAt(lagosMonday8, MONDAY_0610_UTC)?.toISOString()).toBe(
      '2025-09-01T07:00:00.000Z',
    )
  })

  it('handles half-hour offsets', () => {
    const kolkata = { ...lagosMonday8, timezone: 'Asia/Kolkata', digestHour: 13 }
    expect(nextIssueAt(kolkata, MONDAY_0610_UTC)?.toISOString()).toBe('2025-09-01T07:30:00.000Z')
  })

  it('skips to next week when this week was already sent', () => {
    const sent = { ...lagosMonday8, lastDigestSentAt: '2025-09-01T06:00:00Z' }
    expect(nextIssueAt(sent, MONDAY_0610_UTC)?.toISOString()).toBe('2025-09-08T07:00:00.000Z')
  })

  it('returns null while digests are paused', () => {
    expect(nextIssueAt({ ...lagosMonday8, digestEnabled: false }, MONDAY_0610_UTC)).toBeNull()
  })
})

describe('labels', () => {
  it('formats hours on a 12-hour clock', () => {
    expect(hourLabel(0)).toBe('12:00 AM')
    expect(hourLabel(12)).toBe('12:00 PM')
    expect(hourLabel(15)).toBe('3:00 PM')
  })

  it('formats the issue time in the user timezone', () => {
    expect(issueTimeLabel(new Date('2025-09-01T07:00:00Z'), 'Africa/Lagos')).toMatch(
      /^Monday,? 8:00\sAM$/,
    )
  })
})
