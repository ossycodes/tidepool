import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ImportPanel from '@/components/ImportPanel.vue'
import { api, type Blog, type ImportResult } from '@/lib/api'

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

  it('imports a pasted list in batches of 10 and summarises the outcome', async () => {
    const urls = Array.from({ length: 12 }, (_, i) => `blog${i}.test`)
    const importBlogs = vi.spyOn(api, 'importBlogs').mockImplementation(async (batch) =>
      batch.map((url, i): ImportResult =>
        url === 'blog11.test'
          ? { url, status: 'failed', error: "Couldn't load it" }
          : { url, status: i === 0 ? 'already' : 'followed', blog: blog(url) },
      ),
    )
    const wrapper = mount(ImportPanel)

    await wrapper.find('textarea').setValue(urls.join('\n'))
    expect(wrapper.text()).toContain('12 blogs found')
    await wrapper.findAll('button').find((b) => b.text().startsWith('Import'))!.trigger('click')
    await flushPromises()

    expect(importBlogs).toHaveBeenCalledTimes(2)
    expect(importBlogs.mock.calls[0]![0]).toHaveLength(10)
    expect(wrapper.find('.import__summary').text()).toContain('9 followed')
    expect(wrapper.find('.import__summary').text()).toContain('2 already followed')
    expect(wrapper.find('.failures__url').text()).toBe('blog11.test')
    expect(wrapper.find('.failures__why').text()).toBe("Couldn't load it")
    expect(wrapper.emitted('followed')!.flat(2)).toHaveLength(11)
  })

  it('retries only the failures', async () => {
    const importBlogs = vi
      .spyOn(api, 'importBlogs')
      .mockResolvedValueOnce([
        { url: 'a.test', status: 'followed', blog: blog('a') },
        { url: 'b.test', status: 'failed', error: 'Nope' },
      ])
      .mockResolvedValueOnce([{ url: 'b.test', status: 'followed', blog: blog('b') }])
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
})
