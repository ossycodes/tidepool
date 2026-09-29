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

Themed bundles shown on the empty reading list: 39 packs (171 blogs) in 7 topics (Tech, Work & money, Health & wellbeing, Science & ideas, Culture & arts, Home & life, Hobbies & outdoors). "Follow all" runs through the same batch import as [[OPML import and export]].

Every address was checked with our own feed discovery before it went in (`web/src/lib/starterPacks.ts`). Packs with fewer than 3 working blogs were dropped at first. After the fetcher fix ([[Sites blocking our fetcher]], #25), Running & endurance, History, Film & TV and Cars & motoring came back, and six packs regained blogs that had been blocked.
