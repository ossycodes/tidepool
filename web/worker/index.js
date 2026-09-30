// Serves the Vue app's static files. Only /shared/* runs through this code
// (see run_worker_first in wrangler.jsonc): link-preview crawlers don't run
// JavaScript, so the shared list's name and blogs go into the meta tags here.

/** Overridable for local testing: `wrangler dev --var API_URL:http://localhost:3000` */
const DEFAULT_API_URL = 'https://api.usetidepool.app'

/** The list's blogs from the API, or null if it's unavailable or gone. */
async function sharedList(apiUrl, id) {
  try {
    const res = await fetch(`${apiUrl}/shared/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(1500),
      cf: { cacheTtl: 300 },
    })
    if (!res.ok) return null
    const { blogs } = await res.json()
    return Array.isArray(blogs) ? blogs : null
  } catch {
    return null
  }
}

function preview(blogs) {
  if (!blogs?.length) {
    return {
      title: 'A reading list, shared with you on Tidepool',
      description: 'Pick the blogs you like and get their new posts in one quiet weekly email.',
    }
  }
  const names = blogs.slice(0, 3).map((b) => b.title)
  const more = blogs.length - names.length
  const plural = blogs.length === 1 ? 'blog' : 'blogs'
  return {
    title: `A reading list with ${blogs.length} ${plural}, shared on Tidepool`,
    description: `${names.join(', ')}${more > 0 ? ` and ${more} more` : ''}. Pick the ones you like and get their new posts in one weekly email.`,
  }
}

class SetContent {
  constructor(value) {
    this.value = value
  }
  element(el) {
    el.setAttribute('content', this.value)
  }
}

export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request)
    const url = new URL(request.url)
    const match = /^\/shared\/([\w-]+)\/?$/.exec(url.pathname)
    if (!match || !(res.headers.get('content-type') ?? '').includes('text/html')) return res

    const { title, description } = preview(
      await sharedList(env.API_URL ?? DEFAULT_API_URL, match[1]),
    )
    return new HTMLRewriter()
      .on('meta[property="og:title"]', new SetContent(title))
      .on('meta[property="og:description"]', new SetContent(description))
      .on('meta[name="description"]', new SetContent(description))
      .on('meta[property="og:url"]', new SetContent(`https://${url.host}${url.pathname}`))
      .transform(res)
  },
}
