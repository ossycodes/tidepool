# Tidepool web

The Vue 3 + Vite frontend for Tidepool. It talks to the NestJS API in the repo
root.

## Run it

```bash
# 1. The API (from the repo root): docker compose up -d && npm run start:dev
# 2. The web app:
cd web
cp .env.example .env   # VITE_API_URL, defaults to http://localhost:3000
npm install
npm run dev            # http://localhost:5173 (must match the API's FRONTEND_URL)
```

Sign-in emails land in Mailpit at <http://localhost:8025>.

| Script              | What it does                    |
| ------------------- | ------------------------------- |
| `npm run dev`       | Dev server on :5173             |
| `npm run build`     | Type-check and production build |
| `npm run test:unit` | Vitest (jsdom)                  |

## Structure

- `src/styles/`: design tokens (`tokens.css`) and base styles. Every color,
  radius and shadow comes from tokens, with light and dark themes.
- `src/lib/`: the API client, session (token in `localStorage`), toasts, date
  formatting, and `schedule.ts`, which mirrors the API's digest schedule so the UI
  can show when the next issue arrives.
- `src/components/ui/`: small primitives (button, spinner, toaster, monogram,
  logo).
- `src/views/`: one component per route.

## Quick add

Put the app's address in front of any blog URL to follow it, like
`tidepool.example/www.schneems.com` or `tidepool.example/https://jvns.ca/`.
The router's catch-all ([`lib/quickAdd.ts`](src/lib/quickAdd.ts)) turns any
path whose first segment is a domain into `/reading?follow=<url>`. Signed-out
visitors sign in first, and the follow happens after the magic link.

**Hosting:** the server must return `index.html` for every unknown path,
including ones with dots such as `/www.schneems.com`. Some static hosts treat
dotted paths as missing files. Vite's dev server already handles this.

## Design notes

Tidepool is a calm, weekly ritual, so the UI is editorial rather than
dashboard-like: Newsreader for display type, Inter for UI, warm paper tones and
a single sea-glass accent. Amber and rose are reserved for status. The weekly
digest is treated as an "issue" (numbered, with a masthead), both on the landing
page specimen and in the app.
