import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')

describe('security headers', () => {
  const headers = read('../../public/_headers')
  const csp = /Content-Security-Policy: (.+)/.exec(headers)?.[1] ?? ''

  it('allows the inline theme script in index.html by its hash', () => {
    // The CSP blocks inline scripts except this one. If index.html's script
    // changes, copy the new hash from this test's failure into _headers.
    const inline = [
      ...read('../../index.html').matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
    ].map((m) => m[1]!)
    expect(inline).toHaveLength(1)
    const hash = createHash('sha256').update(inline[0]!).digest('base64')
    expect(csp).toContain(`'sha256-${hash}'`)
  })

  it('keeps the policy strict', () => {
    expect(csp).not.toContain('unsafe-inline')
    expect(csp).not.toContain('unsafe-eval')
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
  })

  it('allows the Web Analytics beacon Cloudflare injects on the live site', () => {
    expect(csp).toMatch(/script-src [^;]*https:\/\/static\.cloudflareinsights\.com/)
    expect(csp).toMatch(/connect-src [^;]*https:\/\/cloudflareinsights\.com/)
  })

  it('lets the app reach its API', () => {
    const api = /VITE_API_URL=(.+)/.exec(read('../../.env.cloudflare'))?.[1]?.trim()
    expect(api).toBeTruthy()
    expect(csp).toContain(`connect-src 'self' ${api}`)
  })
})
