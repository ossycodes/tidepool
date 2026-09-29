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

Themed bundles shown on the empty reading list: 35 packs (146 blogs) in 7 topics (Tech, Work & money, Health & wellbeing, Science & ideas, Culture & arts, Home & life, Hobbies & outdoors). "Follow all" runs through the same batch import as [[OPML import and export]].

Every address was checked with our own feed discovery before it went in (`web/src/lib/starterPacks.ts`). Packs with fewer than 3 working blogs were dropped; see [[Sites blocking our fetcher]].
