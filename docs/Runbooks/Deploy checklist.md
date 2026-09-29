---
title: Deploy checklist
tags:
  - runbook
---

# Deploy checklist

- [ ] Domain bought; `FRONTEND_URL` and `APP_URL` point at it
- [ ] Production Postgres and Redis; `npm run db:deploy` on each release
- [ ] Long random `JWT_SECRET`
- [ ] Real SMTP provider; SPF, DKIM and DMARC records ([[Email deliverability]])
- [ ] Static host serves `index.html` for every unknown path, **including dotted
      ones** like `/www.schneems.com` ([[SPA fallback for quick add]])
- [ ] `@tidepoolapp` and `help@tidepool.app` exist and are ours (`web/src/lib/brand.ts`)
- [ ] Trust the proxy for rate limiting (`app.set('trust proxy', 1)`) if behind a load balancer
- [ ] Uptime check on `GET /health`
- [ ] Only one instance runs the schedulers, or accept duplicate enqueues (jobs are deduplicated)
