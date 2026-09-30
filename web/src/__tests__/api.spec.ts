import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'

describe('api requests', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('gives up on a server that never answers, with a clear message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError')),
    )
    await expect(api.me()).rejects.toThrow('Tidepool is taking too long to respond')
  })

  it('explains an unreachable server separately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(api.me()).rejects.toThrow("Can't reach Tidepool right now")
  })

  it('sends every request with a deadline', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
    await api.blogs()
    const init = fetch.mock.calls[0]![1] as RequestInit
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })
})
