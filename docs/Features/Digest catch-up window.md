---
status: in-progress
type: tech-debt
area: digest
priority: 2
tags:
  - tech-debt
---

# Digest catch-up window

Before: the scheduler only sent during the reader's exact delivery hour. If it was down for that whole hour (a deploy, a crash, Redis down), that issue was silently skipped.

## Now
- `latestSlot()` finds the reader's most recent scheduled delivery, the last occurrence of their hour that fell on a delivery day. It's one calculation, not a search, so it's cheap for every reader every 15 minutes.
- `dueSlot()` sends it if it **hasn't been served** (`lastDigestSentAt` is before the slot and the gap has passed) and it's **recent enough**: up to 24 h late for weekly, fortnightly and monthly, and 6 h for daily (`CATCH_UP_MS`), so a late daily issue doesn't crowd the next one.
- `MIN_GAP_MS` shrank (12 h / 5 d / 12 d / 20 d) so a late issue never pushes the next on-time one back. Fortnightly still skips the week in between.
- Queue jobs are keyed by **slot** (`digest-<user>-<slot ms>`), so repeated 15-minute ticks and a catch-up across UTC midnight both dedupe to one job per issue.
- A reader who signs up shortly after their slot gets a catch-up check too. With nothing new yet, it counts as an empty issue (no email).
