---
title: Decisions
tags:
  - decisions
aliases:
  - ADR
---

# Decisions

Short records of choices that would surprise a newcomer. Add new ones at the bottom.

## Magic-link sign-in
No passwords. Tokens are 32 random bytes, stored only as SHA-256, single-use
(claimed with a conditional update), 15-minute expiry. `POST /auth/magic-link`
always returns `202` so it can't reveal which emails have accounts. A `User` is
created on first verify, not on request, so typing emails can't fill the table.

## SSRF-safe fetching
We fetch user-supplied URLs, so every request goes through `safeFetch`: http(s)
only, private/loopback/link-local addresses refused **at connect time** (a
custom DNS lookup, so DNS rebinding can't bypass it), timeouts, 5 redirects,
20 MB cap (full-content feeds like danluu.com are ~6.5 MB).

## Backfill baseline
Posts that already exist when a blog is first fetched are stored with
`backfill = true` and never emailed; otherwise a new follow would flood the next
digest. A blog nobody followed for 24h+ is re-baselined for the same reason.

## Lenient XML parsing
Real feeds are often invalid XML (schneems.com: `title="Buns & Bits"`,
`title="How to "Sustain Heroku""`). We escape bare ampersands outside CDATA,
parse strictly, and retry in loose mode on failure. A fresh parser per feed —
a shared one leaked state and made results alternate.

## Unsubscribe confirm page
Email security scanners prefetch links, so `GET /digests/unsubscribe` only shows
a button; `POST` unsubscribes (also serving RFC 8058 one-click). Unsubscribe
tokens are JWTs with `typ: "unsubscribe"` and can't be used to sign in.

## PRs against main
Open every PR against `main` and merge with merge commits. PRs based on other
PR branches become a GitHub "stack" that blocks merging and retargeting.

## Public stats privacy
`/stats` publishes totals only. A blog appears in "most followed" only with two
or more followers, so the page never reveals what a single reader follows.

## Imports run from the browser in batches
`POST /blogs/batch` takes at most 10 URLs and the web app loops over them,
rather than the server running a background import job. Discovery can take
seconds per blog; small batches keep each request short, give real progress,
and let the reader stop part-way without any job state on the server.
Small imports (a starter pack, a shared list) go one blog per request, up to
5 in parallel, so progress visibly ticks; big ones use full batches of 10, one
at a time, to stay inside the 30/min limit (`web/src/lib/importPlan.ts`).

## Starter pack blogs are verified, not guessed
Every starter pack address was run through our own feed discovery before it
was added. Sites that block our fetcher (HTTP 403) were left out rather than
shipped broken; see [[Sites blocking our fetcher]].

## Theme is a per-device setting
The light/dark choice lives in `localStorage`, not on the user record. It's a
property of the screen you're reading on (a dark phone, a light laptop), it
works on signed-out pages, and it can be applied before first paint without
waiting for the API.

## Shared lists are anonymous
`/shared/:id` shows blogs only: each blog's own title and latest post, never
the sharer's email or their private renames. The id is 64 random bits, not a
username, so links can't be guessed or enumerated, and "Make a new link"
retires a link that spread further than intended. Sharing is off until the
reader turns it on.

## We stay an identified bot
Many Cloudflare sites rejected Node's default TLS handshake with a 403. We fix
that by advertising the protocol we really speak (`ALPNProtocols:
['http/1.1']`), not by pretending to be a browser: the User-Agent stays
`TidepoolBot`, so a site that wants to block us by name still can, and we
respect it. Sites that block everything get a plain explanation.

## Sessions are revocable JWTs
Access tokens stay stateless JWTs (30 days), but each carries the user's
`tokenVersion`, and the auth guard compares it on every request. "Sign out
everywhere" bumps the version, which ends every session at once, and a
deleted account's token fails the lookup. The cost is one primary-key read per
authenticated request; that's cheap at our size and far simpler than a
session table. Plain "Sign out" still only forgets the token in that browser.

## Mail goes through Resend's HTTPS API
Railway blocks outbound SMTP below the Pro plan, which we found when every
sign-in request hung and returned 500 in production. With `RESEND_API_KEY`
set, `MailService` posts to Resend's API instead; SMTP (Mailpit) stays for
local development so nothing needs an account to run. The production key is
send-only, and both paths give up after 15 s so a slow provider fails fast.

## Library content is shared; reading state is private (feature branch)

Article extraction runs on demand in BullMQ, independently of feed discovery and
email sending, so a difficult source cannot delay a digest. Full content is cached
once per post and sanitized before storage. Highlights use exact offsets and a
content hash; stale/fabricated selections are rejected rather than attached to the
wrong passage. Personal state and collections live separately from subscriptions,
so unfollowing does not remove saved articles. AI is optional and configured only
on the API; no provider credentials reach the browser. It cites paragraph IDs and
labels background knowledge, while the UI reminds readers to check sources.

If a scraped source merges into a known feed, its orphan blog record is retained
when it holds saved posts or annotations. Its subscriptions move to the feed,
so the fetch scheduler stops polling the old source. This preserves original
article IDs and annotation versions without copying notes onto different text.

## AGPL-3.0, not MIT

Tidepool is a hosted service, so a permissive license would let anyone run a
closed, modified copy against usetidepool.app. AGPL-3.0 makes anyone who serves
a modified version to other people publish their source under the same terms;
self-hosting it for yourself carries no obligation. The license is
`AGPL-3.0-only`, so a future GNU revision doesn't apply without a deliberate
relicense. Both `package.json` files stay `"private": true`, which only stops
an accidental npm publish.
