---
status: planned
type: tech-debt
area: feeds
priority: 3
effort: S
tags:
  - tech-debt
---

# Blogs Tentacle can follow and we can't

Found while adding a Tentacle reader's shared list to [[Starter packs]] (#27). Our discovery said "Couldn't find a feed or any posts on that page" for three blogs Tentacle lists. Investigated 2026-09-29:

## mikerogers.io: the site is gone
The domain is parked and redirects to a domain-sale page (twinspirits.us). Tentacle's card shows the last post as **7 Aug 2021**: it followed the blog years ago and still shows that stale record. Nobody can follow it today. Nothing to fix.

## thehistoryoftheweb.com and avdi.codes: the host's bot check
Both return **200 with an HTML page titled "One moment, please..."**: an obfuscated script checks for headless browsers, then posts a computed token (`wsidchk`) to get a cookie and reloads. It's the anti-bot challenge used by hosts like SiteGround (`Server: openresty`).

- The feeds (`/feed/`, `/rss`) are challenged too, for every client tried (our bot name, curl, a Feedly User-Agent). So the challenge depends on the requester, most likely **IP reputation**, not on the URL or User-Agent.
- Tentacle still gets new posts (History of the Web: June 2026), so its servers either come from IPs the host trusts or run a real browser. We can't tell which from outside.
- **We don't solve the challenge.** It's the site owner's bot protection. See [[Decisions#We stay an identified bot]].
- In production, our server's IP may be treated differently from a home connection. Recheck after deploy.
- No alternative feed exists: `avdi.substack.com` has one "Coming soon" post from 2023, and History of the Web has no Substack or FeedBurner feed.

## Small fix worth making
Detect challenge pages (200 + `<title>One moment, please...` / `wsidchk`, or Cloudflare's "Just a moment...") and say so plainly: "This site asks visitors to pass a browser check, which Tidepool can't do. Try again later, or paste its feed address." That's better than "Couldn't find a feed or any posts".
