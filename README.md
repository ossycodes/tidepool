# Tidepool

One email a week with all the new posts from the blogs you follow — even the
ones without an RSS feed.

This repo is the backend: a NestJS 12 API with Postgres (Prisma 7), Redis
(BullMQ) and SMTP (Nodemailer).

## Local setup

```bash
cp .env.example .env          # then set JWT_SECRET to a long random string
docker compose up -d          # Postgres :5433, Redis :6380, Mailpit :1025/:8025
npm install                   # also runs `prisma generate`
npm run db:migrate            # apply migrations
npm run start:dev
```

Outgoing email is caught by Mailpit: <http://localhost:8025>

## Scripts

| Script               | What it does                              |
| -------------------- | ----------------------------------------- |
| `npm run start:dev`  | API with watch mode                       |
| `npm test`           | Unit tests (Vitest)                       |
| `npm run test:e2e`   | E2E tests — needs `docker compose up -d`  |
| `npm run lint`       | oxlint                                    |
| `npm run db:migrate` | Create/apply migrations in development    |
| `npm run db:deploy`  | Apply migrations in production            |

## Security notes

Tidepool fetches arbitrary user-supplied URLs, so all outbound HTTP goes through
[`safeFetch`](src/common/safe-fetch.ts): http(s) only, private/loopback/link-local
addresses are refused at connect time (so DNS rebinding is covered too), plus
timeouts, a redirect cap and a 5 MB response limit.

## API

| Method | Path      | Auth | Description           |
| ------ | --------- | ---- | --------------------- |
| GET    | `/health` | —    | Liveness + DB check   |
