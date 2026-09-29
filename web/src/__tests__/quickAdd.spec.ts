import { describe, expect, it } from 'vitest'
import { quickAddTarget } from '@/lib/quickAdd'

describe('quickAddTarget', () => {
  it.each([
    ['/www.schneems.com', 'www.schneems.com'],
    ['/www.schneems.com/', 'www.schneems.com/'],
    ['/jvns.ca/blog/2025/post', 'jvns.ca/blog/2025/post'],
    ['/https://jvns.ca/', 'https://jvns.ca/'],
    ['/https:/jvns.ca/', 'https://jvns.ca/'],
    ['/http%3A%2F%2Fexample.com%2Ffeed.xml', 'http://example.com/feed.xml'],
    ['/example.com/archive?page=2', 'example.com/archive?page=2'],
    ['/localhost.test:8080/blog', 'localhost.test:8080/blog'],
  ])('reads %s as %s', (path, expected) => {
    expect(quickAddTarget(path)).toBe(expected)
  })

  it.each(['/', '/reading', '/settings', '/auth/callback', '/nope', '/not a url.com', '/.com'])(
    'ignores %s',
    (path) => {
      expect(quickAddTarget(path)).toBeNull()
    },
  )
})
