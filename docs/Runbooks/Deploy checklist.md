---
title: Deploy checklist
tags:
  - runbook
---

# Deploy checklist

- [x] Domain bought: `usetidepool.app` (Cloudflare). Web app live there; API planned at `api.usetidepool.app`
- [ ] API `FRONTEND_URL` and `APP_URL` set to `https://usetidepool.app`
- [ ] Production Postgres and Redis; `npm run db:deploy` on each release
- [ ] Long random `JWT_SECRET`
- [ ] Real SMTP provider; SPF, DKIM and DMARC records ([[Email deliverability]])
- [x] Static host serves `index.html` for every unknown path, **including dotted
      ones** like `/www.schneems.com` ([[SPA fallback for quick add]], [[Deploy the web app]])
- [ ] `@tidepoolapp` and `help@usetidepool.app` exist and are ours (`web/src/lib/brand.ts`)
- [ ] Trust the proxy for rate limiting (`app.set('trust proxy', 1)`) if behind a load balancer
- [ ] Uptime check on `GET /health`
- [ ] Only one instance runs the schedulers, or accept duplicate enqueues (jobs are deduplicated)
