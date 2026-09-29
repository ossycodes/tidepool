const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "example.com" or "example.com/blog", without www. */
export function hostLabel(url: string): string {
  try {
    const { hostname, pathname } = new URL(url)
    const host = hostname.replace(/^www\./, '')
    const path = pathname.replace(/\/+$/, '')
    return path ? `${host}${path}` : host
  } catch {
    return url
  }
}

/** "3 days ago", "yesterday"; falls back to a date after a month. */
export function timeAgo(value: string | Date, now = new Date()): string {
  const date = new Date(value)
  const diff = date.getTime() - now.getTime()
  const abs = Math.abs(diff)
  if (abs < HOUR) return relative.format(Math.round(diff / MINUTE), 'minute')
  if (abs < DAY) return relative.format(Math.round(diff / HOUR), 'hour')
  if (abs < 30 * DAY) return relative.format(Math.round(diff / DAY), 'day')
  return shortDate(date, now)
}

/** "in 5 days", "tomorrow", "in 3 hours" */
export function timeUntil(value: Date, now = new Date()): string {
  const diff = value.getTime() - now.getTime()
  if (diff < HOUR) return relative.format(Math.max(1, Math.round(diff / MINUTE)), 'minute')
  if (diff < DAY) return relative.format(Math.round(diff / HOUR), 'hour')
  return relative.format(Math.round(diff / DAY), 'day')
}

/** "Sep 2", or "Sep 2, 2024" when not in the current year. */
export function shortDate(value: string | Date, now = new Date(), timeZone?: string): string {
  const date = new Date(value)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
    timeZone,
  })
}

export function plural(count: number, word: string, pluralWord = `${word}s`): string {
  return `${count} ${count === 1 ? word : pluralWord}`
}

/** The date a post "happened": when it was published, else when we found it. */
export function postDate(post: { publishedAt: string | null; discoveredAt: string }): string {
  return post.publishedAt ?? post.discoveredAt
}

/** "3 days ago", or "found 3 days ago" for scraped posts with no publish date. */
export function postAge(post: { publishedAt: string | null; discoveredAt: string }): string {
  return post.publishedAt ? timeAgo(post.publishedAt) : `found ${timeAgo(post.discoveredAt)}`
}
