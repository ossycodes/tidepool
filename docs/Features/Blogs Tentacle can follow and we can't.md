---
status: planned
type: tech-debt
area: feeds
priority: 2
effort: S
tags:
  - tech-debt
---

# Blogs Tentacle can follow and we can't

Found while adding a Tentacle reader's shared list to [[Starter packs]] (#27). Tentacle follows these, but our discovery says "Couldn't find a feed or any posts on that page":

- `avdi.codes/blog` (also `avdi.codes`, `avdi.codes/feed`)
- `mikerogers.io` (also `/feed.xml`, `/rss.xml`)
- `thehistoryoftheweb.com` (also `/feed`)

Next step: fetch each with our fetcher and look at what comes back. It could be a JavaScript challenge page, a feed link our `findFeedLinks` misses, or post markup `extractArticleLinks` doesn't recognise. Related: [[Sites blocking our fetcher]].
