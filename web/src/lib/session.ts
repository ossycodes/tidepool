import { computed, reactive } from 'vue'
import { api, configureApi, type User } from './api'

const TOKEN_KEY = 'tidepool.token'

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Private mode or blocked storage: the session just won't survive a reload.
  }
}

const state = reactive({
  token: readToken(),
  user: null as User | null,
})

let onSignedOut: () => void = () => {}

configureApi({
  getToken: () => state.token,
  onUnauthorized: () => {
    signOut()
    onSignedOut()
  },
})

export function signIn(token: string, user: User) {
  state.token = token
  state.user = user
  writeToken(token)
}

export function signOut() {
  state.token = null
  state.user = null
  writeToken(null)
}

/** Called when an expired or revoked token is rejected by the API. */
export function onSessionExpired(handler: () => void) {
  onSignedOut = handler
}

export async function loadUser(): Promise<User> {
  const user = await api.me()
  state.user = user
  return user
}

export function setUser(user: User) {
  state.user = user
}

export const session = {
  state,
  isAuthenticated: computed(() => state.token !== null),
}
