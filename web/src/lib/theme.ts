import { computed, ref } from 'vue'

// Light, dark or follow the device. Saved per browser; index.html applies the
// saved choice before first paint so the page never flashes the wrong theme.

export type ThemePreference = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'tidepool.theme'

/** Matches `--paper` in tokens.css, for the browser's toolbar colour. */
const THEME_COLOR: Record<Theme, string> = {
  light: '#faf8f3',
  dark: '#151412',
}

const darkQuery = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

const preference = ref<ThemePreference>(readPreference())
const systemDark = ref(darkQuery()?.matches ?? false)

const theme = computed<Theme>(() =>
  preference.value === 'system' ? (systemDark.value ? 'dark' : 'light') : preference.value,
)

function apply() {
  document.documentElement.dataset.theme = theme.value
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme.value])
}

export function setThemePreference(next: ThemePreference) {
  preference.value = next
  try {
    if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Private mode or blocked storage: the choice lasts for this visit only.
  }
  apply()
}

/** Switches to the opposite of what's showing now. */
export function toggleTheme() {
  setThemePreference(theme.value === 'dark' ? 'light' : 'dark')
}

/** Applies the theme and follows the device while the preference is "system". */
export function initTheme() {
  darkQuery()?.addEventListener('change', (event) => {
    systemDark.value = event.matches
    apply()
  })
  apply()
}

export function useTheme() {
  return { preference, theme, setThemePreference, toggleTheme }
}
