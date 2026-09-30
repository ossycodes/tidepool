---
title: Deploy the web app
tags:
  - runbook
---

# Deploy the web app

The Vue app runs on **Cloudflare** at **https://usetidepool.app**, as a Worker serving static assets. That's the successor to Cloudflare Pages: Wrangler 4 no longer creates classic Pages projects. Account `116652d335a3998dbb32e0f416709821`, Worker `tidepool`.

## Automatic deploys

`.github/workflows/deploy-web.yml` deploys on every push to `main` that touches `web/`: `npm ci`, type-check, unit tests, `build:cloudflare`, then `wrangler deploy`. A failing test stops the deploy. It can also be run by hand (Actions, then *Deploy web*, then *Run workflow*).

The workflow needs, in the GitHub repo settings:
- **Secret `CLOUDFLARE_API_TOKEN`:** a Cloudflare API token from the *Edit Cloudflare Workers* template, limited to this account and the `usetidepool.app` zone.
- **Variable `CLOUDFLARE_ACCOUNT_ID`:** `116652d335a3998dbb32e0f416709821`.

## Deploy by hand

```sh
cd web
nvm use 22          # Wrangler 4 needs Node 22+
npx wrangler@4 login   # first time only
npm run deploy      # build:cloudflare, then wrangler deploy
```

- `npm run build:cloudflare` builds with `--mode cloudflare` into `dist-cloudflare/`. It reads `web/.env.cloudflare`, which sets `VITE_API_URL=https://api.usetidepool.app`. `dist/` stays for local preview against `localhost:3000`.
- `web/wrangler.jsonc`:
  - `assets.not_found_handling: "single-page-application"`: unknown paths get `index.html`, so Vue routes and [[Quick add]] (`/www.schneems.com`) work.
  - `routes`: `usetidepool.app` as a custom domain. Cloudflare creates the DNS record and certificate.

## Link previews

- `web/index.html` holds the Open Graph and Twitter tags. `web/public/og.png` (1200×630, about 180 KB) is the preview image for every page; `apple-touch-icon.png` is the home-screen icon.
- **Shared lists** (`/shared/:id`) get their own title and description from a small Worker, `web/worker/index.js`. `run_worker_first: ["/shared/*"]` means only those requests run code; everything else is served straight from assets. It reads `GET /shared/:id` from the API, with a 1.5 s timeout and a 5-minute cache. If that fails, it falls back to "A reading list, shared with you on Tidepool".
- Test locally: `npm run build:cloudflare && npx wrangler@4 dev --var API_URL:http://localhost:3000`, then `curl localhost:8787/shared/<id>`.
- After changing the image, refresh the platforms' caches with the LinkedIn Post Inspector and Facebook's Sharing Debugger. WhatsApp and X refresh on their own after a while.

## Check after deploying

```sh
for p in / /reading /shared/abc /www.schneems.com; do
  curl -s -o /dev/null -w "$p %{http_code}\n" https://usetidepool.app$p
done
```

## Not done yet
- The API isn't deployed, so sign-in fails until `api.usetidepool.app` is live. Its `FRONTEND_URL`/`APP_URL` must be `https://usetidepool.app` (CORS and magic links). See [[Deploy checklist]].
- `www.usetidepool.app` isn't set up.
