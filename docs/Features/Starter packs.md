---
status: shipped
type: feature
area: web
priority: 1
pr: 17
shipped: 2026-09-29
tags:
  - feature
---

# Starter packs

Themed bundles shown on the empty reading list: 46 packs (204 blogs) in 7 topics (Tech, Work & money, Health & wellbeing, Science & ideas, Culture & arts, Home & life, Hobbies & outdoors). Following runs through the same batch import as [[OPML import and export]].

Since #54 (from reader feedback), each blog in a pack is a chip: tap to pick just the ones you want ("Follow 2 selected"), or pick none to follow the whole pack. A "Starter packs" link opens the packs on a non-empty list too; blogs you already follow show as dashed "✓" chips and the button offers "Follow the other N". Matching uses `blogKey()` (no scheme, `www.`, query or trailing slash) against each blog's site and feed URLs.

Every address was checked with our own feed discovery before it went in (`web/src/lib/starterPacks.ts`). Packs with fewer than 3 working blogs were dropped at first. After the fetcher fix ([[Sites blocking our fetcher]], #25), Running & endurance, History, Film & TV and Cars & motoring came back, and six packs regained blogs that had been blocked.

The Ruby, languages, web dev, company engineering, leadership and personal-blog packs came from a real reader's list shared on Tentacle (`usetentacle.app/shared/gKbQR0Jrq4`), checked the same way.
