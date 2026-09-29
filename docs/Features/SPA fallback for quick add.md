---
status: in-progress
type: tech-debt
area: infra
priority: 1
effort: S
tags:
  - tech-debt
---

# SPA fallback for quick add

Production host must serve `index.html` for dotted paths like `/www.schneems.com`.

Solved on Cloudflare with `"not_found_handling": "single-page-application"` in `web/wrangler.jsonc`. Checked live: `/www.schneems.com`, `/reading` and `/shared/abc` all return the app. See [[Deploy the web app]].
