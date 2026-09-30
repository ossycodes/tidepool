---
status: in-progress
type: feature
area: digest
priority: 2
tags:
  - feature
---

# Delivery frequency

Readers choose how often the digest arrives, and can hold quiet issues back.

- **How often:** Daily, Weekly (default), Every 2 weeks, or Monthly (`User.digestFrequency`). Monthly means the **first chosen weekday of each month**, e.g. the first Monday. Daily ignores the day.
- **Minimum posts:** "Send when there's any new post / at least 3 / 5 / 10" (`User.digestMinPosts`, 1–50). A due issue with fewer new posts is **held**: `send()` gives back its claim, so the posts roll into the next issue instead of being skipped. An issue with no posts at all still counts as sent (`empty`), as before.
- **Scheduling:** `isDigestDue` checks the hour, then the weekday (not for daily), then days 1–7 of the month (monthly). The minimum gap between issues depends on the frequency (`MIN_GAP_MS`: 20 h, 6 d, 13 d, 20 d). This guards against double sends and makes "every 2 weeks" skip the week in between. The scheduler prefilters with the shortest gap.
- The web app's `nextIssueAt` mirrors the same rules for the "Next issue" line and the Settings summary.
- The marketing copy still says "one email a week", which stays the default.
