// Where to go after signing in. The magic link can't carry it, so it waits in
// sessionStorage between requesting the link and clicking it (same tab).

const KEY = 'tidepool.next'

function isSafePath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//')
}

export function rememberNext(path: string) {
  if (!isSafePath(path)) return
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    // Storage unavailable: fall back to the default landing page.
  }
}

export function takeNext(): string | null {
  try {
    const path = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return path && isSafePath(path) ? path : null
  } catch {
    return null
  }
}
