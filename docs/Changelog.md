---
title: Changelog
tags:
  - changelog
---

# Changelog

All merged to `main` on 2026-09-29. Newest first. PR #3 doesn't exist (GitHub skipped the number).

| PR | Change |
|---|---|
| #54 | Starter packs: pick individual blogs from a pack, and open packs anytime from the reading list, with blogs you follow marked ([[Starter packs]]) |
| #53 | Fix: ops alerts send from production only; a local server with the bot token was alerting on leftover test blogs ([[Telegram alerts]]) |
| #52 | Home page title says what Tidepool does ("Tidepool: every blog you follow, in one email"), for browser suggestions and history |
| #51 | Logo mark in every email's masthead (PNG from `web/public/email-logo.png`; email clients block SVG) |
| #49 | Fix: production mail goes through Resend's HTTPS API (Railway blocks SMTP below Pro), so sign-in links send; sending times out after 15 s ([[Decisions#Mail goes through Resend's HTTPS API]]) |
| #48 | Telegram ops alerts: new readers, new blogs, failing blogs, failed digests, 5xx errors, API started ([[Telegram alerts]]) |
| #47 | API requests time out (15 s; longer for discovery and email) instead of loading forever |
| #46 | Sign out everywhere: tokens carry `tokenVersion`, checked by the guard; deleted accounts' tokens get 401 ([[Security review 2026-09-30]]) |
| #45 | Fix: the reading list's scroll-into-view broke tests (CSS.escape in jsdom) and blocked #44's deploy |
| #44 | Just-followed blogs stay at the top of the reading list with a tag, until the next visit |
| #43 | CSP allows Cloudflare Web Analytics (found blocked in the live check after #42) |
| #42 | Security hardening from the OWASP review: `TRUST_PROXY`, security headers, quick add asks first, pinned CI ([[Security review 2026-09-30]]) |
| #41 | e2e tests isolated from dev data and background jobs (flaky failures) |
| #40 | [[Re-check scraped blogs for feeds]]: scraped blogs switch to a feed once one appears (or merge into it) |
| #39 | [[Keyword filters]]: mute words everywhere, and only-include / leave-out words per blog |
| #38 | [[Digest catch-up window]]: missed issues go out late (up to a day) instead of being skipped |
| #37 | [[Delivery frequency]]: daily, weekly, every 2 weeks or monthly, and "only send with at least N posts" |
| #36 | Link previews: branded og.png, Open Graph tags, and shared-list previews from a small Worker ([[Deploy the web app]]) |
| #35 | Deploy workflow pins Wrangler 4 (first automatic deploy succeeded) |
| #34 | Automatic deploys: pushes to `main` touching `web/` deploy to usetidepool.app after type-check and tests ([[Deploy the web app]]) |
| #33 | Sign-in form: separate input and button on phones |
| #32 | Support address is `help@usetidepool.app` (forwarded by Cloudflare Email Routing) |
| #31 | Web app live on Cloudflare at usetidepool.app ([[Deploy the web app]], [[SPA fallback for quick add]]) |
| #30 | Docs: #28 and #29 recorded |
| #29 | Bot-check pages get a clear message instead of "no posts found" ([[Blogs Tentacle can follow and we can't]]) |
| #28 | Docs: #26 and #27 recorded; findings on three blogs Tentacle lists |
| #27 | [[Starter packs]]: 46 packs, 204 blogs (restored after #25, plus a Tentacle reader's list) |
| #26 | Docs: #24 and #25 recorded |
| #25 | [[Sites blocking our fetcher]]: 9 of 18 blocked blogs now followable; clear message for the rest |
| #24 | Docs: #22 and #23 recorded |
| #23 | Import progress you can see: panel scrolls into view, bar ticks per blog ([[OPML import and export]], [[Starter packs]]) |
| #22 | Docs: #18, #19 and #21 recorded as shipped (#20 closed in its favour) |
| #21 | [[Shared reading lists]]: `/shared/:id` pages, Settings → Sharing |
| #19 | [[Theme toggle]]: light/dark button in every header, Settings → Appearance |
| #18 | Docs: #16 and #17 recorded as shipped |
| #17 | [[OPML import and export]] (`POST /blogs/batch`, `GET /blogs/export.opml`) and [[Starter packs]]: 35 packs in 7 topics |
| #16 | `CLAUDE.md`: resume from the vault after compaction |
| #15 | Obsidian vault in `docs/` ([[Home]], [[Tracker.base\|tracker]], [[Decisions]]) and `CLAUDE.md` |
| #14 | [[Rename and pause blogs]] |
| #13 | [[Open stats]] page and `GET /stats` |
| #12 | README screenshots; fixed header and settings overflowing on phones |
| #11 | [[Quick add]] tip in the digest footer |
| #10 | [[Next issue page]], [[Settings page]], homepage help line |
| #9 | Malformed XML feeds parse reliably ([[Decisions#Lenient XML parsing]]) |
| #8 | [[Quick add]]: prefix any URL with the app's address |
| #7 | [[Branded emails]]; Atom HTML summaries stripped to text |
| #6 | [[Web app]]: design system, sign-in, reading list |
| #5 | [[Weekly digest]] at each reader's local time |
| #4 | [[Follow any blog]]: discovery, scraping fallback, fetching |
| #2 | [[Magic-link sign-in]] and user settings |
| #1 | Foundation: config, Prisma schema, SSRF-safe fetch, health |

> [!note] Keep this current
> Add a row for every merged PR and link the feature note it changes.
