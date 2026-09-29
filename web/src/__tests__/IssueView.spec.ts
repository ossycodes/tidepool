import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { api, type DigestPreview, type User } from '@/lib/api'
import { setUser } from '@/lib/session'
import { useToasts } from '@/lib/toast'
import IssueView from '@/views/IssueView.vue'

const user: User = {
  id: 'u1',
  email: 'reader@example.com',
  digestEnabled: true,
  digestDay: 1,
  digestHour: 8,
  timezone: 'UTC',
  lastDigestSentAt: null,
  shareId: null,
  createdAt: '2025-09-01T00:00:00Z',
}

const preview: DigestPreview = {
  since: '2025-09-01T00:00:00Z',
  sections: [
    {
      blog: { id: 'b1', title: 'Julia Evans', siteUrl: 'https://jvns.ca/' },
      posts: [
        {
          id: 'p1',
          url: 'https://jvns.ca/blog/post',
          title: 'A new post',
          summary: 'About things',
          author: 'Julia',
          publishedAt: new Date().toISOString(),
          discoveredAt: new Date().toISOString(),
        },
      ],
    },
  ],
}

async function mountIssue() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: IssueView },
      { path: '/reading', component: IssueView },
      { path: '/settings', component: IssueView },
    ],
  })
  await router.push('/')
  await router.isReady()
  const wrapper = mount(IssueView, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

describe('IssueView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setUser(user)
    useToasts().value = []
  })

  it('renders the posts collected so far and the issue number', async () => {
    vi.spyOn(api, 'digestPreview').mockResolvedValue(preview)
    vi.spyOn(api, 'digestHistory').mockResolvedValue([
      { id: 'd1', sentAt: '2025-09-22T08:00:00Z', postCount: 4 },
    ])
    const wrapper = await mountIssue()

    expect(wrapper.find('.eyebrow').text()).toContain('No. 2')
    expect(wrapper.find('.sheet__intro').text()).toContain('1 new post from 1 blog')
    expect(wrapper.find('.sheet__title').text()).toBe('A new post')
    expect(wrapper.find('.past__list').text()).toContain('No. 1')
  })

  it('shows an empty state and disables the preview button', async () => {
    vi.spyOn(api, 'digestPreview').mockResolvedValue({ since: preview.since, sections: [] })
    vi.spyOn(api, 'digestHistory').mockResolvedValue([])
    const wrapper = await mountIssue()

    expect(wrapper.text()).toContain('Nothing new yet.')
    expect(wrapper.find('button').attributes('disabled')).toBeDefined()
  })

  it('emails a preview on request', async () => {
    vi.spyOn(api, 'digestPreview').mockResolvedValue(preview)
    vi.spyOn(api, 'digestHistory').mockResolvedValue([])
    const send = vi.spyOn(api, 'sendTestDigest').mockResolvedValue({ sent: true, postCount: 1 })
    const wrapper = await mountIssue()

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(send).toHaveBeenCalled()
    expect(useToasts().value.slice(-1)[0]?.message).toBe('Sent a preview to reader@example.com')
  })
})
