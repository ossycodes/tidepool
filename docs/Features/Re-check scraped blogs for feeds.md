---
status: in-progress
type: tech-debt
area: feeds
priority: 2
tags:
  - tech-debt
---

# Re-check scraped blogs for feeds

Blogs followed in scrape mode (no feed at the time) used to stay in scrape mode forever, even after the site added a feed.

## Now
- During a scraped blog's normal fetch, **at most once a week** (`Blog.feedCheckedAt`, `FEED_RECHECK_MS`), `IngestService` looks for a feed using the page it already downloaded: advertised links first, then the usual feed addresses (`DiscoveryService.findFeed`). New scraped blogs record the check when they're followed, since discovery has just looked.
- **Feed found:** the blog switches to `FEED` mode in place. The feed's current items are stored as **backfill**, so its archive doesn't flood anyone's next digest; later items arrive as usual. Readers keep their renames, pauses and keyword filters.
- **Another blog already uses that feed:** its followers are **merged** into that blog (keeping their name, pause and filters, and keeping the existing subscription for anyone who followed both), and the duplicate scraped blog is deleted. Its old posts and their digest links go with it; digest history keeps its post counts.
- A failed check is logged and never fails the fetch.
