---
status: planned
type: tech-debt
area: feeds
priority: 2
effort: M
tags:
  - tech-debt
---

# Sites blocking our fetcher

Some popular blogs answer our fetcher with HTTP 403 (bot protection), so they can't be followed at all. Found while verifying [[Starter packs]]: FlowingData, Get Rich Slowly, Atlas Obscura, History Today, RogerEbert.com, Criterion and Autoblog were all dropped for this reason.

Ideas:

- Send a browser-like `User-Agent` and `Accept` headers, keeping a `Tidepool` token so owners can identify us.
- Retry a 403 once with the feed URL guessed from common paths (`/feed`, `/rss.xml`).
- Tell the reader plainly when a site blocks us, rather than showing a generic "couldn't load it".
