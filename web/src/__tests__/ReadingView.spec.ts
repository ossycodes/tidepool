import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError, api, type Blog } from '@/lib/api'
import { STARTER_PACKS } from '@/lib/starterPacks'
import ReadingView from '@/views/ReadingView.vue'

const blog = (overrides: Partial<Blog> = {}): Blog => ({
  id: 'b1',
  title: 'Julia Evans',
  originalTitle: 'Julia Evans',
  customTitle: null,
  paused: false,
  includeKeywords: [],
  excludeKeywords: [],
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

async function mountReading(path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: ReadingView }],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(ReadingView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('ReadingView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'digestHistory').mockResolvedValue([])
  })

  it('offers starter packs when nothing is followed yet', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([])
    const importBlogs = vi.spyOn(api, 'importBlogs').mockResolvedValue([
      { url: 'danluu.com', status: 'followed', blog: blog({ id: 'b9', title: 'Dan Luu' }) },
    ])
    const { wrapper } = await mountReading()
    expect(wrapper.text()).toContain('Nothing to read yet.')
    expect(wrapper.findAll('.pack').length).toBeGreaterThan(3)

    const follow = wrapper.findAll('.pack button')[0]!
    await follow.trigger('click')
    await flushPromises()

    expect(importBlogs.mock.calls.flatMap((call) => call[0]).sort()).toEqual(
      STARTER_PACKS[0]!.blogs.map((b) => b.url).sort(),
    )
    expect(wrapper.find('.row__title').text()).toBe('Dan Luu')
  })

  it('switches starter packs by topic', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([])
    const { wrapper } = await mountReading()

    const health = wrapper.findAll('.category').find((b) => b.text() === 'Health & wellbeing')!
    await health.trigger('click')

    expect(health.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.pack__name').map((n) => n.text())).toEqual(
      STARTER_PACKS.filter((p) => p.category === 'Health & wellbeing').map((p) => p.name),
    )
  })

  it('follows a blog and adds it to the list', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([])
    const follow = vi.spyOn(api, 'followBlog').mockResolvedValue(blog())
    const { wrapper } = await mountReading()

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
    const { wrapper } = await mountReading()

    await wrapper.find('input[aria-label="Blog address"]').setValue('example.com')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('#add-status').text()).toContain("We couldn't find any posts there")
  })

  it('asks before following a blog passed by quick add', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([])
    const follow = vi
      .spyOn(api, 'followBlog')
      .mockResolvedValue(blog({ id: 'b2', title: 'Schneems' }))
    const { wrapper, router } = await mountReading('/?follow=www.schneems.com')
    await flushPromises()

    // Any site can link here, so nothing is followed until the reader agrees.
    expect(follow).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query.follow).toBeUndefined()
    expect(wrapper.find('.quick-add').text()).toContain('Follow www.schneems.com?')

    await wrapper.findAll('.quick-add button').find((b) => b.text() === 'Follow')!.trigger('click')
    await flushPromises()

    expect(follow).toHaveBeenCalledWith('www.schneems.com')
    expect(wrapper.find('.row__title').text()).toBe('Schneems')
    expect(wrapper.find('.quick-add').exists()).toBe(false)
  })

  it('can turn down a quick-add link', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([])
    const follow = vi.spyOn(api, 'followBlog')
    const { wrapper } = await mountReading('/?follow=spam.example')
    await flushPromises()

    await wrapper.findAll('.quick-add button').find((b) => b.text() === 'No thanks')!.trigger('click')

    expect(follow).not.toHaveBeenCalled()
    expect(wrapper.find('.quick-add').exists()).toBe(false)
  })

  async function chooseFromMenu(wrapper: Awaited<ReturnType<typeof mountReading>>['wrapper'], label: string) {
    await wrapper.find('.menu__trigger').trigger('click')
    await flushPromises()
    const item = wrapper.findAll('[role="menuitem"]').find((b) => b.text() === label)
    expect(item, `menu item "${label}"`).toBeTruthy()
    await item!.trigger('click')
    await flushPromises()
  }

  it('renames a blog from the row menu', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([blog({ title: 'Essays', originalTitle: 'Essays' })])
    const update = vi.spyOn(api, 'updateBlog').mockResolvedValue(
      blog({ title: 'Paul Graham', originalTitle: 'Essays', customTitle: 'Paul Graham' }),
    )
    const { wrapper } = await mountReading()

    await chooseFromMenu(wrapper, 'Rename')
    const input = wrapper.find('input[aria-label="Blog name"]')
    await input.setValue('  Paul Graham ')
    await wrapper.find('form.rename').trigger('submit')
    await flushPromises()

    expect(update).toHaveBeenCalledWith('b1', { title: 'Paul Graham' })
    expect(wrapper.find('.row__title').text()).toBe('Paul Graham')
    expect(wrapper.find('.row__host').text()).toContain('originally “Essays”')
  })

  it('filters one blog to posts about chosen words', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([blog()])
    const update = vi
      .spyOn(api, 'updateBlog')
      .mockImplementation(async (_id, patch) =>
        blog({ includeKeywords: patch.includeKeywords ?? [] }),
      )
    const { wrapper } = await mountReading()

    await chooseFromMenu(wrapper, 'Filter posts')
    const include = wrapper.find('.filters input')
    await include.setValue('Rust')
    await include.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(update).toHaveBeenCalledWith('b1', { includeKeywords: ['Rust'] })
    await wrapper.findAll('button').find((b) => b.text() === 'Done')!.trigger('click')
    expect(wrapper.find('.tag--button').text()).toContain('Filtered')
  })

  it('clearing the name restores the original', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([
      blog({ title: 'Paul Graham', originalTitle: 'Essays', customTitle: 'Paul Graham' }),
    ])
    const update = vi
      .spyOn(api, 'updateBlog')
      .mockResolvedValue(blog({ title: 'Essays', originalTitle: 'Essays', customTitle: null }))
    const { wrapper } = await mountReading()

    await chooseFromMenu(wrapper, 'Rename')
    await wrapper.find('input[aria-label="Blog name"]').setValue('')
    await wrapper.find('form.rename').trigger('submit')
    await flushPromises()

    expect(update).toHaveBeenCalledWith('b1', { title: null })
    expect(wrapper.find('.row__title').text()).toBe('Essays')
  })

  it('pauses a blog and shows it as paused', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([blog()])
    const update = vi.spyOn(api, 'updateBlog').mockResolvedValue(blog({ paused: true }))
    const { wrapper } = await mountReading()

    await chooseFromMenu(wrapper, 'Pause in digests')

    expect(update).toHaveBeenCalledWith('b1', { paused: true })
    expect(wrapper.find('.row').classes()).toContain('is-paused')
    expect(wrapper.find('.tag').text()).toContain('Paused')
  })

  it('reverts a change the API rejects', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([blog()])
    vi.spyOn(api, 'updateBlog').mockRejectedValue(new ApiError(500, 'Nope'))
    const { wrapper } = await mountReading()

    await chooseFromMenu(wrapper, 'Pause in digests')

    expect(wrapper.find('.row').classes()).not.toContain('is-paused')
  })

  it('labels blogs that have no feed', async () => {
    vi.spyOn(api, 'blogs').mockResolvedValue([blog({ fetchMode: 'SCRAPE' })])
    const { wrapper } = await mountReading()
    expect(wrapper.find('.tag').text()).toContain('Watching page')
  })
})
