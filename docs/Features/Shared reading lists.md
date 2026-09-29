---
status: shipped
type: feature
area: growth
priority: 1
pr: 21
shipped: 2026-09-29
aliases:
  - Public reading lists
tags:
  - feature
---

# Shared reading lists

Like Tentacle's `/shared/…` pages: a reader turns on sharing and gets a link like `/shared/xk8kNYdzgcg`. Anyone with it sees the blogs they follow and can pick which ones to follow.

- **Turning it on:** Settings → Sharing (switch, copy, make a new link), or **Share** on the reading list, which turns it on and copies the link.
- **The page:** every blog is ticked by default, with its latest post. Blogs the visitor already follows show "Following". The sticky bar follows the picks through the same batch import as [[OPML import and export]].
- **Signed-out visitors** sign in and come straight back to the list (`next`, see [[Quick add]]).
- **Privacy:** anonymous. It shows each blog's own title, never the sharer's renames or email. A new link retires the old one, and turning sharing off makes the link 404. See [[Decisions#Shared lists are anonymous]].
- API: `POST`/`DELETE /me/share`, public `GET /shared/:id`. Data: `User.shareId`.
