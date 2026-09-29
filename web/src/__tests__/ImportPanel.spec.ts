import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImportPanel from '@/components/ImportPanel.vue'
import { api, type Blog, type ImportResult } from '@/lib/api'
import { planBatches } from '@/lib/importPlan'

const blog = (id: string): Blog => ({
  id,
  title: id,
  originalTitle: id,
  customTitle: null,
  paused: false,
  description: null,
  siteUrl: `https://${id}.test/`,
  sourceUrl: `https://${id}.test/feed.xml`,
  fetchMode: 'FEED',
  subscribedAt: '2025-09-01T00:00:00Z',
  lastFetchedAt: null,
  healthy: true,
  lastError: null,
  latestPost: null,
})

describe('ImportPanel', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('imports a pasted list and summarises the outcome', async () => {
    const urls = Array.from({ length: 12 }, (_, i) => `blog${i}.test`)
    const importBlogs = vi.spyOn(api, 'importBlogs').mockImplementation(async (batch) =>
      batch.map((url): ImportResult =>
        url === 'blog11.test'
          ? { url, status: 'failed', error: "Couldn't load it" }
          : { url, status: url === 'blog0.test' ? 'already' : 'followed', blog: blog(url) },
      ),
    )
    const wrapper = mount(ImportPanel)

    await wrapper.find('textarea').setValue(urls.join('\n'))
    expect(wrapper.text()).toContain('12 blogs found')
    await wrapper.findAll('button').find((b) => b.text().startsWith('Import'))!.trigger('click')
    await flushPromises()

    // Every blog is sent exactly once, in batches the API accepts.
    const sent = importBlogs.mock.calls.map((call) => call[0])
    expect(sent.flat().sort()).toEqual([...urls].sort())
    expect(sent.every((batch) => batch.length <= 10)).toBe(true)
    expect(wrapper.find('.import__summary').text()).toContain('10 followed')
    expect(wrapper.find('.import__summary').text()).toContain('1 already followed')
    expect(wrapper.find('.failures__url').text()).toBe('blog11.test')
    expect(wrapper.find('.failures__why').text()).toBe("Couldn't load it")
    expect(wrapper.emitted('followed')!.flat(2)).toHaveLength(11)
  })

  it('retries only the failures', async () => {
    let failB = true
    const importBlogs = vi.spyOn(api, 'importBlogs').mockImplementation(async (batch) =>
      batch.map((url): ImportResult => {
        if (url !== 'b.test') return { url, status: 'followed', blog: blog('a') }
        if (!failB) return { url, status: 'followed', blog: blog('b') }
        failB = false
        return { url, status: 'failed', error: 'Nope' }
      }),
    )
    const wrapper = mount(ImportPanel)

    await (wrapper.vm as unknown as { start: (u: string[]) => Promise<void> }).start([
      'a.test',
      'b.test',
    ])
    await flushPromises()
    await wrapper.findAll('button').find((b) => b.text() === 'Try those again')!.trigger('click')
    await flushPromises()

    expect(importBlogs).toHaveBeenLastCalledWith(['b.test'])
    expect(wrapper.find('.import__summary').text()).toContain('1 followed')
  })

  it('shows each blog as it lands', async () => {
    let finish!: () => void
    vi.spyOn(api, 'importBlogs').mockImplementation(async ([url]) => {
      if (url === 'slow.test') await new Promise<void>((resolve) => (finish = resolve))
      return [{ url: url!, status: 'followed', blog: blog(url!) }]
    })
    const wrapper = mount(ImportPanel)

    void (wrapper.vm as unknown as { start: (u: string[]) => Promise<void> }).start([
      'fast.test',
      'slow.test',
    ])
    await flushPromises()

    expect(wrapper.find('[role="progressbar"]').attributes('aria-valuenow')).toBe('1')
    expect(wrapper.find('.tick').text()).toContain('fast.test')
    finish()
    await flushPromises()
    expect(wrapper.find('.import__summary').text()).toContain('2 followed')
  })
})

describe('planBatches', () => {
  it('sends small imports one blog at a time, in parallel', () => {
    const { batches, parallel } = planBatches(['a', 'b', 'c', 'd', 'e'])
    expect(batches).toEqual([['a'], ['b'], ['c'], ['d'], ['e']])
    expect(parallel).toBe(5)
  })

  it('uses full batches of 10, one at a time, for big imports', () => {
    const urls = Array.from({ length: 146 }, (_, i) => `b${i}`)
    const { batches, parallel } = planBatches(urls)
    expect(batches).toHaveLength(15)
    expect(batches[0]).toHaveLength(10)
    expect(parallel).toBe(1)
  })
})
