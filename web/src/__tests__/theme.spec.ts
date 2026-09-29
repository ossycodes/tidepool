import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { THEME_STORAGE_KEY, initTheme, setThemePreference, useTheme } from '@/lib/theme'

describe('theme', () => {
  afterEach(() => setThemePreference('system'))

  it('follows the device until the reader picks a theme', () => {
    initTheme()
    // jsdom reports no dark preference, so "system" resolves to light.
    expect(document.documentElement.dataset.theme).toBe('light')

    setThemePreference('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    setThemePreference('system')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('toggles between light and dark from the header button', async () => {
    const wrapper = mount(ThemeToggle)
    const button = wrapper.find('button')
    expect(button.attributes('aria-label')).toBe('Switch to dark theme')

    await button.trigger('click')
    expect(useTheme().theme.value).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(button.attributes('aria-label')).toBe('Switch to light theme')

    await button.trigger('click')
    expect(useTheme().theme.value).toBe('light')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })
})
