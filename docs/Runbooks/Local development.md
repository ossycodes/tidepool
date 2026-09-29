---
title: Local development
tags:
  - runbook
---

# Local development

```bash
cp .env.example .env            # set JWT_SECRET
docker compose up -d            # Postgres :5433, Redis :6380, Mailpit :1025 / UI :8025
npm install && npm run db:migrate
npm run start:dev               # API on :3000
cd web && npm install && npm run dev   # web on :5173 (must match FRONTEND_URL)
```

Sign-in links and digests land in Mailpit: <http://localhost:8025>.

## Tests

| Command | What |
|---|---|
| `npm test` | API unit tests |
| `npm run test:e2e` | API end-to-end (needs Docker running) |
| `cd web && npx vitest run` | Web unit and component tests |
| `cd web && npm run type-check` | `vue-tsc` |

## Gotchas

- **Prisma 7:** run `npx prisma generate` after `migrate dev`.
- **Node 20:** `web/` pins jsdom 26 (jsdom 30 needs Node 22).
- **Ports:** 5432/6379 were taken by other containers, hence 5433/6380.
- **Branch switching** while Vite runs can leave it without the Vue plugin →
  restart the dev server.
- **Local data** includes many e2e test users and `*.test` blogs, so `/open`
  shows inflated numbers locally.
- **Git over SSH** is sometimes rejected even when `ssh -T git@github.com`
  works; one-off HTTPS: `git -c credential.helper= -c 'credential.helper=!gh auth git-credential' push https://github.com/ossycodes/tidepool.git <branch>`.

See [[Deploy checklist]] before going live.
