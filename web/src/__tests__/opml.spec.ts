import { describe, expect, it } from 'vitest'
import { parseImport } from '@/lib/opml'

describe('parseImport', () => {
  it('reads feed URLs from nested OPML outlines', () => {
    const opml = `<?xml version="1.0"?>
<opml version="2.0"><head><title>Feeds</title></head><body>
  <outline text="Tech">
    <outline type="rss" text="Julia" xmlUrl="https://jvns.ca/atom.xml" htmlUrl="https://jvns.ca/"/>
    <outline type="rss" text="Dan" xmlUrl="https://danluu.com/atom.xml"/>
  </outline>
  <outline type="link" text="PG" url="https://paulgraham.com/articles.html"/>
</body></opml>`
    expect(parseImport(opml)).toEqual([
      'https://jvns.ca/atom.xml',
      'https://danluu.com/atom.xml',
      'https://paulgraham.com/articles.html',
    ])
  })

  it('falls back to attributes when the OPML is not valid XML', () => {
    const sloppy = `<opml><body><outline text="Tom & Jerry" xmlUrl="https://a.test/feed?x=1&amp;y=2"></body></opml>`
    expect(parseImport(sloppy)).toEqual(['https://a.test/feed?x=1&y=2'])
  })

  it('reads a pasted list, skipping non-addresses and duplicates', () => {
    const list = `jvns.ca
      https://www.jvns.ca/
      danluu.com, not a blog, overreacted.io
      hello`
    expect(parseImport(list)).toEqual(['jvns.ca', 'danluu.com', 'overreacted.io'])
  })
})
