---
status: in-progress
type: feature
area: web
priority: 1
effort: L
tags:
  - feature
---

# Library and reader

Implementation branch: `feat/library-reader`.

Save articles from a blog's recent posts or Next issue. The Library has shelf,
cover and list views, search by title/author/blog, favourites, unread/reading/read
filters and private collections. Book previews open into a two-page spread;
keyboard previews open instantly and reduced motion removes movement.

The reader extracts full articles on demand, preserves headings, emphasis,
links, code and images, resumes at the last paragraph, supports larger text,
and saves highlights and personal notes. Desktop notes live in the margin;
phones use a modal bottom drawer. Source links remain available when extraction
fails or a site requires a subscription.

## Implementation

- `ArticleProcessor`: bounded BullMQ worker (concurrency 2), safe HTTP fetching,
  Readability extraction, DOMPurify allowlist, stable paragraph IDs and a content
  hash. JSDOM executes no scripts and loads no subresources. Cached content is
  reused between readers. Full feed content is used first when available.
- `UserPost`: personal saved/favourite/read state and last paragraph; independent
  of digest delivery. Saved posts remain available after unfollowing their blog.
- `Collection`: private membership checked on every assignment. Deleting a
  collection keeps its articles.
- `Annotation`: exact quote/offsets and surrounding text, content version, note
  and private AI thread. Server rejects fabricated or stale passage anchors.
- AI: optional `AI_API_KEY`, `AI_MODEL`, `AI_BASE_URL` (defaults to Together's
  chat-completions endpoint). Streaming SSE, abort and timeout handling, bounded
  article context/output and conversation history. Quick/deep control output
  budgets (500/1200 tokens), not different models or web research.
- Limits: 30 AI requests per reader/hour, quota claims serialized across API
  instances; one live request per reader/process, 200 notes per article,
  40 turns per thread, 30 collections per reader. AI calls send the article,
  selected passage, question and recent thread messages to the configured provider.

## Setup

Apply the additive database migration with `npm run db:deploy`, then run
`npx prisma generate` and restart the API. Redis/BullMQ must be available for
article extraction. Set the optional AI variables on the API only; restart
it after changing them. No client keys are needed.

Existing posts have no retained full feed body: they use article-page extraction.
New feed posts retain full content where the feed supplies it. Extraction is
best-effort; Tidepool does not bypass paywalls or bot blocks. Article images load
from their original HTTPS hosts without a referrer; the CSP permits HTTPS images
while keeping scripts and styles restricted to the existing trusted sources.

## Validation

API unit and integration tests cover sanitization, caching, feed content,
ownership, collections, reading state, exact anchors, AI streaming/persistence
and quota enforcement. Web tests cover passage offsets and highlights across
inline formatting, library filtering, reader interactions and streaming state.
Browser QA uses an isolated test account and a local AI fixture, never a live
provider key. Verify desktop/mobile, light/dark, reduced motion, native dialog
focus, passage questions and reload persistence.

This note remains in progress until the branch merges. No production deployment
has been performed.
