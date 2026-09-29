import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiError, api, type User } from '@/lib/api'
import { session, setUser, signIn } from '@/lib/session'
import SettingsView from '@/views/SettingsView.vue'

const user: User = {
  id: 'u1',
  email: 'reader@example.com',
  digestEnabled: true,
  digestDay: 1,
  digestHour: 8,
  timezone: 'Africa/Lagos',
  lastDigestSentAt: null,
  createdAt: '2025-09-01T00:00:00Z',
}

async function mountSettings() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/settings', component: SettingsView },
      { path: '/', name: 'home', component: SettingsView },
    ],
  })
  await router.push('/settings')
  await router.isReady()
  const wrapper = mount(SettingsView, { global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

describe('SettingsView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    signIn('token', user)
  })

  it('saves the delivery day as soon as it changes', async () => {
    const update = vi
      .spyOn(api, 'updateMe')
      .mockImplementation(async (patch) => ({ ...user, ...patch }))
    const { wrapper } = await mountSettings()

    await wrapper.find('[role="radio"][title="Friday"]').trigger('click')
    await flushPromises()

    expect(update).toHaveBeenCalledWith({ digestDay: 5 })
    expect(session.state.user?.digestDay).toBe(5)
    expect(wrapper.find('[role="radio"][title="Friday"]').attributes('aria-checked')).toBe('true')
    expect(wrapper.text()).toContain('Saved')
  })

  it('pauses digests with the switch', async () => {
    const update = vi
      .spyOn(api, 'updateMe')
      .mockImplementation(async (patch) => ({ ...user, ...patch }))
    const { wrapper } = await mountSettings()

    await wrapper.find('[role="switch"]').trigger('click')
    await flushPromises()

    expect(update).toHaveBeenCalledWith({ digestEnabled: false })
    expect(wrapper.find('.summary').text()).toContain('Digests are paused')
  })

  it('reverts a change the API rejects', async () => {
    vi.spyOn(api, 'updateMe').mockRejectedValue(new ApiError(400, 'timezone must be valid'))
    const { wrapper } = await mountSettings()

    await wrapper.find('select').setValue('20')
    await flushPromises()

    expect(session.state.user?.digestHour).toBe(8)
  })

  it('deletes the account only after confirming', async () => {
    const remove = vi.spyOn(api, 'deleteMe').mockResolvedValue(undefined)
    const { wrapper, router } = await mountSettings()

    const deleteButton = wrapper.findAll('button').find((b) => b.text() === 'Delete account…')!
    await deleteButton.trigger('click')
    await flushPromises()
    expect(remove).not.toHaveBeenCalled()

    const confirm = wrapper.findAll('button').find((b) => b.text() === 'Yes, delete my account')!
    await confirm.trigger('click')
    await flushPromises()

    expect(remove).toHaveBeenCalled()
    expect(session.isAuthenticated.value).toBe(false)
    expect(router.currentRoute.value.name).toBe('home')
    setUser(user)
  })
})
