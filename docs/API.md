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
| GET / PATCH / DELETE | `/me` | ✓ | Settings: `digestEnabled`, `digestFrequency` (`DAILY`/`WEEKLY`/`FORTNIGHTLY`/`MONTHLY`), `digestDay`, `digestHour`, `digestMinPosts` (1–50), `timezone`; `shareId` (read-only) |
| POST | `/me/share` | ✓ | Turn on the shared list (keeps an existing link); `{ reset: true }` issues a new link |
| DELETE | `/me/share` | ✓ | Turn sharing off; the link 404s |
| GET | `/blogs` | ✓ | Followed blogs with health, latest post, `customTitle`, `paused` |
| POST | `/blogs` | ✓ | `{ url }` → follow (homepage or feed URL; RSS optional) |
| POST | `/blogs/batch` | ✓ | `{ urls }` (1–10) → per-URL `followed` / `already` / `failed`; 30/min |
| GET | `/blogs/export.opml` | ✓ | OPML 2.0 download of followed blogs (your titles; scraped blogs as `type="link"`) |
| GET | `/blogs/:id` | ✓ | One followed blog |
| PATCH | `/blogs/:id` | ✓ | `{ title?, paused? }` — rename (null restores) and pause |
| GET | `/blogs/:id/posts` | ✓ | Recent posts, `?limit=` 1–100 |
| DELETE | `/blogs/:id` | ✓ | Unfollow |
| GET | `/digests` | ✓ | Last 20 digests |
| GET | `/digests/preview` | ✓ | What the next digest would contain now |
| POST | `/digests/test` | ✓ | Email yourself the preview (3/hour) |
| GET / POST | `/digests/unsubscribe?token=` | public | Confirm page / unsubscribe ([[Decisions#Unsubscribe confirm page]]) |

Web routes: `/`, `/auth/callback`, `/reading`, `/issue`, `/settings`, `/open`,
and any `/<domain>/…` path for [[Quick add]].
