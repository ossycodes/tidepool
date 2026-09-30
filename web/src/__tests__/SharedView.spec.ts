import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError, api, type Blog, type ImportResult, type SharedBlog } from '@/lib/api'
import { signIn, signOut } from '@/lib/session'
import SharedView from '@/views/SharedView.vue'

const shared = (name: string): SharedBlog => ({
  title: name,
  description: null,
  siteUrl: `https://${name}.test/`,
  sourceUrl: `https://${name}.test/feed.xml`,
  latestPost: {
    title: `Hello from ${name}`,
    url: `https://${name}.test/hello`,
    publishedAt: new Date().toISOString(),
  },
})

const mine = (name: string): Blog => ({
  id: name,
  title: name,
  originalTitle: name,
  customTitle: null,
  paused: false,
  includeKeywords: [],
  excludeKeywords: [],
  description: null,
  siteUrl: `https://${name}.test/`,
  sourceUrl: `https://www.${name}.test/feed.xml/`,
  fetchMode: 'FEED',
  subscribedAt: '2025-09-01T00:00:00Z',
  lastFetchedAt: null,
  healthy: true,
  lastError: null,
  latestPost: null,
})

async function mountShared() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/shared/:id', component: SharedView },
      { path: '/', name: 'home', component: SharedView },
      { path: '/reading', component: SharedView },
      { path: '/settings', component: SharedView },
    ],
  })
  await router.push('/shared/abc')
  await router.isReady()
  const wrapper = mount(SharedView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('SharedView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    signOut()
  })

  it('follows only the blogs the visitor picks, skipping ones they follow', async () => {
    signIn('token', {
      id: 'u1',
      email: 'me@example.com',
      digestEnabled: true,
      digestDay: 1,
      digestHour: 8,
      digestFrequency: 'WEEKLY',
      digestMinPosts: 1,
      mutedKeywords: [],
      timezone: 'UTC',
      lastDigestSentAt: null,
      shareId: null,
      createdAt: '2025-09-01T00:00:00Z',
    })
    vi.spyOn(api, 'sharedList').mockResolvedValue({
      blogs: [shared('alpha'), shared('beta'), shared('gamma')],
    })
    vi.spyOn(api, 'blogs').mockResolvedValue([mine('beta')])
    const importBlogs = vi.spyOn(api, 'importBlogs').mockImplementation(async (urls) =>
      urls.map((url): ImportResult => ({
        url,
        status: 'followed',
        blog: mine(url),
      })),
    )
    const { wrapper } = await mountShared()

    // beta is already followed (same address, written differently).
    expect(wrapper.findAll('input[type="checkbox"]')).toHaveLength(2)
    expect(wrapper.find('.is-following').text()).toContain('beta')
    expect(wrapper.find('.bar').text()).toContain('2 of 2 blogs selected')

    await wrapper.find('input[type="checkbox"]').setValue(false)
    await wrapper.find('.bar button.btn').trigger('click')
    await flushPromises()

    expect(importBlogs).toHaveBeenCalledWith(['https://gamma.test/feed.xml'])
  })

  it('sends signed-out visitors to sign in, then back here', async () => {
    vi.spyOn(api, 'sharedList').mockResolvedValue({ blogs: [shared('alpha')] })
    const blogs = vi.spyOn(api, 'blogs')
    const { wrapper, router } = await mountShared()

    expect(blogs).not.toHaveBeenCalled()
    const follow = wrapper.find('.bar button.btn')
    expect(follow.text()).toContain('Sign in to follow 1 blog')
    await follow.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('home')
    expect(router.currentRoute.value.query.next).toBe('/shared/abc')
  })

  it('explains a link that no longer works', async () => {
    vi.spyOn(api, 'sharedList').mockRejectedValue(new ApiError(404, 'Not found'))
    const { wrapper } = await mountShared()

    expect(wrapper.text()).toContain('This link doesn’t work anymore')
  })
})
