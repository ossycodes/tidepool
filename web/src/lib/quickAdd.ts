// Quick add: put the Tidepool address in front of any blog URL, e.g.
// tidepool.example/www.schneems.com or tidepool.example/https://jvns.ca/.

const DOMAIN = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?$/i

/**
 * The blog URL embedded in an app path, or null if the path isn't one.
 * App routes never contain a dot in their first segment, so they can't clash.
 */
export function quickAddTarget(fullPath: string): string | null {
  let raw = fullPath.replace(/^\/+/, '')
  try {
    raw = decodeURIComponent(raw)
  } catch {
    // Keep the raw path if it isn't valid percent-encoding.
  }
  // Some browsers and proxies collapse "https://" to "https:/" inside a path.
  raw = raw.replace(/^(https?):\/+/i, '$1://')

  const host = raw.replace(/^https?:\/\//i, '').split(/[/?#]/)[0] ?? ''
  return DOMAIN.test(host) ? raw : null
}

/** "tidepool.example/" for the tip that explains the shortcut. */
export function quickAddPrefix(): string {
  return `${window.location.host}/`
}
