import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError, api, type Blog } from '@/lib/api'
import ReadingView from '@/views/ReadingView.vue'

const blog = (overrides: Partial<Blog> = {}): Blog => ({
  id: 'b1',
  title: 'Julia Evans',
  description: null,
  siteUrl: 'https://jvns.ca/',
  sourceUrl: 'https://jvns.ca/atom.xml',
  fetchMode: 'FEED',
  subscribedAt: '2025-09-01T00:00:00Z',
  lastFetchedAt: '2025-09-01T00:00:00Z',
  healthy: true,
  lastError: null,
  latestPost: {
    id: 'p1',
    url: 'https://jvns.ca/blog/post',
    title: 'A post',
    summary: null,
    author: null,
    publishedAt: '2025-09-01T00:00:00Z',
    discoveredAt: '2025-09-01T00:00:00Z',
  },
  ...overrides,
})

async function mountReading() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: ReadingView }],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(ReadingView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('ReadingView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'digestHistory').mockResolvedValue([])
  })

  it('shows suggestions when nothing is followed yet', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([])
    const wrapper = await mountReading()
    expect(wrapper.text()).toContain('Nothing to read yet.')
    expect(wrapper.findAll('.chip').length).toBeGreaterThan(0)
  })

  it('follows a blog and adds it to the list', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([])
    const follow = vi.spyOn(api, 'followBlog').mockResolvedValue(blog())
    const wrapper = await mountReading()

    await wrapper.find('input[aria-label="Blog address"]').setValue('jvns.ca')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(follow).toHaveBeenCalledWith('jvns.ca')
    expect(wrapper.find('.row__title').text()).toBe('Julia Evans')
    expect((wrapper.find('input[aria-label="Blog address"]').element as HTMLInputElement).value).toBe('')
  })

  it('explains when a page has no posts', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([blog()])
    vi.spyOn(api, 'followBlog').mockRejectedValue(
      new ApiError(422, "Couldn't find a feed or any posts on that page"),
    )
    const wrapper = await mountReading()

    await wrapper.find('input[aria-label="Blog address"]').setValue('example.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#add-status').text()).toContain("We couldn't find any posts there")
  })

  it('labels blogs that have no feed', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([blog({ fetchMode: 'SCRAPE' })])
    const wrapper = await mountReading()
    expect(wrapper.find('.tag').text()).toContain('Watching page')
  })
})
