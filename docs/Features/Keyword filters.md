---
status: in-progress
type: feature
area: digest
priority: 2
tags:
  - feature
---

# Keyword filters

Readers keep topics they don't care about out of their digest.

- **Everywhere:** Settings → Filters → "Mute words everywhere" (`User.mutedKeywords`).
- **Per blog:** from a blog's … menu, "Filter posts" opens a panel on the row with "Only include posts about" (`Subscription.includeKeywords`) and "Leave out posts about" (`excludeKeywords`). A **Filtered** tag on the row summarises the rules and reopens the panel.
- **Matching** (`src/digest/keywords.ts`): case-insensitive **whole words or phrases** in the title and summary. `AI` doesn't match "said", phrases match across extra spaces, and `C++` is literal. A leave-out or muted word wins over an include word. Up to 20 words of up to 50 characters each; blanks and case-insensitive duplicates are dropped.
- **Filters only shape the digest.** The reading list still shows every post. The Next issue page says "Your keyword filters left out N posts", and the preview API returns `filtered`, so nothing vanishes silently.
