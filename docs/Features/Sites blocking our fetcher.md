---
status: in-progress
type: tech-debt
area: feeds
priority: 2
tags:
  - tech-debt
---

# Sites blocking our fetcher

Some popular blogs answered our fetcher with HTTP 403, so they couldn't be followed. Found while verifying [[Starter packs]].

## What was actually happening

Most of them sit behind Cloudflare, whose bot protection rejects **Node's default TLS handshake**, not our name. curl sending the exact same `TidepoolBot` User-Agent got 200 from the same sites. Header changes made no difference from Node. Any change to the TLS fingerprint did.

## Fix

- `safe-fetch.ts` advertises `ALPNProtocols: ['http/1.1']`, the protocol we actually speak. That changes the fingerprint Cloudflare flags, while the User-Agent still identifies us as TidepoolBot. See [[Decisions#We stay an identified bot]].
- It also sends `Accept-Language`, which History Today needs.
- Some sites block their pages but serve the feed anyway (Statmodeling, RogerEbert). When a page returns 401, 402, 403 or 429, discovery tries the common feed addresses before giving up.
- Sites that block everything get a plain message ("… blocks automated readers like Tidepool …") instead of "HTTP 403 fetching …".

## Results (the 18 URLs that failed during the starter-pack check)

- **Now work (9):** FlowingData, Statmodeling, Marathon Handbook, Atlas Obscura, History Today, Inside Climate News, RogerEbert.com, Permanent Style, Serious Eats.
- **Still blocked, now with a clear message (5):** Get Rich Slowly, Criterion, Hagerty, Autoblog, Food52 (429).
- **Different problem, not covered here (4):** Stronger by Science, Science of Running, Nomadic Matt and Andrew Skurka render their posts with JavaScript and advertise no feed.
