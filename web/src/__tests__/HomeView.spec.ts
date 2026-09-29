import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError, api } from '@/lib/api'
import HomeView from '@/views/HomeView.vue'

async function mountHome() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: HomeView }],
  })
  await router.push('/')
  await router.isReady()
  return mount(HomeView, { global: { plugins: [router] }, attachTo: document.body })
}

describe('HomeView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('asks for an email before sending', async () => {
    const request = vi.spyOn(api, 'requestMagicLink')
    const wrapper = await mountHome()
    await wrapper.find('form').trigger('submit')
    expect(request).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').text()).toContain('Enter your email')
    wrapper.unmount()
  })

  it('sends a magic link and shows the inbox state', async () => {
    const request = vi.spyOn(api, 'requestMagicLink').mockResolvedValue({ ok: true })
    const wrapper = await mountHome()
    await wrapper.find('input[type="email"]').setValue('  reader@example.com ')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(request).toHaveBeenCalledWith('reader@example.com')
    expect(wrapper.text()).toContain('Check your inbox')
    expect(wrapper.text()).toContain('reader@example.com')
    wrapper.unmount()
  })

  it('explains validation errors in plain words', async () => {
    vi.spyOn(api, 'requestMagicLink').mockRejectedValue(new ApiError(400, 'email must be an email'))
    const wrapper = await mountHome()
    await wrapper.find('input[type="email"]').setValue('nope')
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toBe("That doesn't look like an email address.")
    wrapper.unmount()
  })
})
