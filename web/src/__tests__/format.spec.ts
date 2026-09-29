import { describe, expect, it } from 'vitest'
import { hostLabel, plural, postAge, timeAgo, timeUntil } from '@/lib/format'

const NOW = new Date('2025-09-10T12:00:00Z')

describe('hostLabel', () => {
  it('drops www and keeps meaningful paths', () => {
    expect(hostLabel('https://www.example.com/')).toBe('example.com')
    expect(hostLabel('https://paulgraham.com/articles.html')).toBe('paulgraham.com/articles.html')
  })
})

describe('relative times', () => {
  it('describes the past', () => {
    expect(timeAgo('2025-09-10T11:30:00Z', NOW)).toBe('30 minutes ago')
    expect(timeAgo('2025-09-09T12:00:00Z', NOW)).toBe('yesterday')
    expect(timeAgo('2025-09-07T12:00:00Z', NOW)).toBe('3 days ago')
    expect(timeAgo('2025-06-01T12:00:00Z', NOW)).toBe('Jun 1')
  })

  it('describes the future', () => {
    expect(timeUntil(new Date('2025-09-10T15:00:00Z'), NOW)).toBe('in 3 hours')
    expect(timeUntil(new Date('2025-09-15T12:00:00Z'), NOW)).toBe('in 5 days')
  })

  it('marks scraped posts by when they were found', () => {
    const scraped = { publishedAt: null, discoveredAt: new Date(Date.now() - 2 * 3600_000).toISOString() }
    expect(postAge(scraped)).toBe('found 2 hours ago')
  })
})

describe('plural', () => {
  it('pluralises', () => {
    expect(plural(1, 'blog')).toBe('1 blog')
    expect(plural(3, 'blog')).toBe('3 blogs')
  })
})
