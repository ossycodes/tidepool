---
title: API
tags:
  - architecture
---

# API

All routes need `Authorization: Bearer <accessToken>` unless marked public.
Validation errors are `400`; missing or not-yours is `404`; discovery failures are `422`.

| Method | Path | Auth | What it does |
|---|---|---|---|
| GET | `/health` | public | Liveness and database check |
| GET | `/stats` | public | Aggregates for `/open`, cached 5 min; blogs listed only with 2+ followers |
| GET | `/shared/:id` | public | A shared reading list: blogs by their own titles, latest post; never the reader. 404 when off. 60/min |
| POST | `/auth/magic-link` | public | `{ email }` → emails a sign-in link (always `202`) |
| POST | `/auth/verify` | public | `{ token, timezone? }` → `{ accessToken, user }` |
| GET / PATCH / DELETE | `/me` | ✓ | Settings: `digestEnabled`, `digestFrequency` (`DAILY`/`WEEKLY`/`FORTNIGHTLY`/`MONTHLY`), `digestDay`, `digestHour`, `digestMinPosts` (1–50), `mutedKeywords` (up to 20, ≤50 chars each), `timezone`; `shareId` (read-only) |
| POST | `/me/share` | ✓ | Turn on the shared list (keeps an existing link); `{ reset: true }` issues a new link |
| POST | `/me/sign-out-everywhere` | ✓ | 204; bumps `tokenVersion`, so every access token issued so far gets 401 |
| DELETE | `/me/share` | ✓ | Turn sharing off; the link 404s |
| GET | `/blogs` | ✓ | Followed blogs with health, latest post, `customTitle`, `paused` |
| POST | `/blogs` | ✓ | `{ url }` → follow (homepage or feed URL; RSS optional) |
| POST | `/blogs/batch` | ✓ | `{ urls }` (1–10) → per-URL `followed` / `already` / `failed`; 30/min |
| GET | `/blogs/export.opml` | ✓ | OPML 2.0 download of followed blogs (your titles; scraped blogs as `type="link"`) |
| GET | `/blogs/:id` | ✓ | One followed blog |
| PATCH | `/blogs/:id` | ✓ | `{ title?, paused?, includeKeywords?, excludeKeywords? }`: rename (null restores), pause, and keyword filters |
| GET | `/blogs/:id/posts` | ✓ | Recent posts, `?limit=` 1–100 |
| DELETE | `/blogs/:id` | ✓ | Unfollow |
| GET | `/digests` | ✓ | Last 20 digests |
| GET | `/digests/preview` | ✓ | What the next digest would contain now |
| POST | `/digests/test` | ✓ | Email yourself the preview (3/hour) |
| GET / POST | `/digests/unsubscribe?token=` | public | Confirm page / unsubscribe ([[Decisions#Unsubscribe confirm page]]) |

Web routes: `/`, `/auth/callback`, `/reading`, `/issue`, `/settings`, `/open`,
and any `/<domain>/…` path for [[Quick add]].

## Library and reader (feature branch)

All routes require an access token. A reader can access a post from a followed
blog or their own saved library. Collections, notes and conversations are private.

| Method | Path | Description |
|---|---|---|
| GET | `/library` | Saved posts with state, reading time and collections |
| POST | `/library/collections` | `{name}` creates/reuses a named collection |
| DELETE | `/library/collections/:id` | Remove collection, keep articles (204) |
| GET | `/library/posts/:id` | Metadata, cached content, state, notes, extraction state and AI availability |
| PATCH | `/library/posts/:id` | `{saved?, favourite?, status?, progress?, paragraph?, collectionIds?}` |
| POST | `/library/posts/:id/extract` | Queue/retry extraction (202); poll GET for ready/failed |
| POST | `/library/posts/:id/notes` | `{paragraph, quote, start, end, version, note?}` validates and saves passage |
| PATCH | `/library/notes/:id` | `{note}` edits own note (204) |
| DELETE | `/library/notes/:id` | Delete own note and its conversation (204) |
| POST | `/library/posts/:id/ask` | `{question, annotationId?, mode?: "quick" \| "deep"}` streams SSE |

Reading status is `UNREAD`, `READING` or `READ`. An empty `collectionIds` removes
all memberships. SSE events: `thread` contains the note, `delta` contains `{text}`,
`done` contains the persisted note, and `error` contains `{message}`. Clients must
receive `done` before treating an answer as saved. Unconfigured AI returns 503;
quota exhaustion returns 400; unknown/unauthorized posts and notes return 404.
