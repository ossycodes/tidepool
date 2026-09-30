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
- [x] Mail through Resend's HTTPS API: set `RESEND_API_KEY` (a send-only key) and `MAIL_FROM`. Don't use SMTP on Railway: outbound SMTP is blocked below the Pro plan, so sign-in requests hang and fail. SPF, DKIM and DMARC records are in Cloudflare ([[Email deliverability]])
- [x] Static host serves `index.html` for every unknown path, **including dotted
      ones** like `/www.schneems.com` ([[SPA fallback for quick add]], [[Deploy the web app]])
- [ ] `@tidepoolapp` and `help@usetidepool.app` exist and are ours (`web/src/lib/brand.ts`)
- [ ] Set `TRUST_PROXY` to the number of proxies in front of the API (1 behind Railway, 2 with Cloudflare in front too), so rate limits see each client's IP. Supported since the security review; see [[Security review 2026-09-30]]
- [ ] Uptime check on `GET /health`
- [ ] `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set for ops alerts ([[Telegram alerts]]); the 🚀 message confirms them
- [ ] Only one instance runs the schedulers, or accept duplicate enqueues (jobs are deduplicated)
