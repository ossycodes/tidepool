// Turns an OPML export (Feedly, Feedbin, NetNewsWire, …) or a pasted list of
// addresses into a deduplicated list of URLs to follow.

const LOOKS_LIKE_URL = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i

export function parseImport(text: string): string[] {
  const candidates = /<opml[\s>]/i.test(text) ? fromOpml(text) : fromList(text)
  const seen = new Set<string>()
  const urls: string[] = []
  for (const raw of candidates) {
    const url = raw.trim()
    const key = url
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/+$/, '')
      .toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    urls.push(url)
  }
  return urls
}

function fromOpml(text: string): string[] {
  const doc = new DOMParser().parseFromString(text, 'text/xml')
  if (!doc.querySelector('parsererror')) {
    return [...doc.querySelectorAll('outline')]
      .map((o) => o.getAttribute('xmlUrl') ?? o.getAttribute('htmlUrl') ?? o.getAttribute('url'))
      .filter((url): url is string => !!url)
  }
  // Many exports aren't valid XML; fall back to reading the attributes directly.
  const decode = (value: string) =>
    value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  const outlines = text.match(/<outline\b[^>]*>/gi) ?? []
  return outlines
    .map((tag) => /\b(?:xmlUrl|htmlUrl|url)="([^"]+)"/i.exec(tag)?.[1])
    .filter((url): url is string => !!url)
    .map(decode)
}

function fromList(text: string): string[] {
  return text.split(/[\s,]+/).filter((token) => LOOKS_LIKE_URL.test(token))
}
