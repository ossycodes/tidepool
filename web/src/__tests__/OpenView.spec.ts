import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { api, type PublicStats } from '@/lib/api'
import OpenView from '@/views/OpenView.vue'

const stats: PublicStats = {
  readers: 1243,
  activeReaders: 980,
  newReadersThisWeek: 41,
  follows: 6200,
  blogsPerReader: 5.1,
  blogs: 2100,
  watchedPages: 320,
  postsThisWeek: 870,
  digestsSent: 15400,
  digestsThisWeek: 960,
  lastDigestAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
  topBlogs: [
    { title: 'Julia Evans', siteUrl: 'https://jvns.ca/', followers: 40 },
    { title: 'danluu.com', siteUrl: 'https://danluu.com/', followers: 20 },
  ],
  generatedAt: new Date().toISOString(),
}

async function mountOpen() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: OpenView },
      { path: '/reading', component: OpenView },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(OpenView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('OpenView', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows the headline numbers, formatted', async () => {
    vi.spyOn(api, 'publicStats').mockResolvedValue(stats)
    const wrapper = await mountOpen()

    const tiles = wrapper.findAll('.tile').map((t) => t.text())
    expect(tiles[0]).toContain('Readers')
    expect(tiles[0]).toContain('1,243')
    expect(tiles[0]).toContain('+41 this week')
    expect(wrapper.text()).toContain('320 without RSS')
    expect(wrapper.text()).toContain('Last digest sent 2 hours ago.')
  })

  it('ranks the most followed blogs with relative bars', async () => {
    vi.spyOn(api, 'publicStats').mockResolvedValue(stats)
    const wrapper = await mountOpen()

    const items = wrapper.findAll('.popular__item')
    expect(items).toHaveLength(2)
    expect(items[0]!.text()).toContain('Julia Evans')
    expect(items[0]!.text()).toContain('40 readers')
    expect(items[1]!.find('.popular__bar').attributes('style')).toContain('--share: 50%')
  })

  it('explains an empty popular list', async () => {
    vi.spyOn(api, 'publicStats').mockResolvedValue({ ...stats, topBlogs: [] })
    const wrapper = await mountOpen()
    expect(wrapper.find('.popular__empty').text()).toContain('at least two readers')
  })
})
