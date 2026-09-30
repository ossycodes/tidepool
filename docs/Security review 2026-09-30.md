---
title: Security review 2026-09-30
tags:
  - security
---

# Security review 2026-09-30

OWASP Top 10:2025 review of the API (`src/`), the web app (`web/`) and the Cloudflare Worker (`web/worker/`), run with the `owasp-security` skill. **No Critical or High findings.** Each finding was traced from an entry point to a sink before being listed.

## Trust boundaries
- **Public routes:** `/auth/magic-link`, `/auth/verify`, `/digests/unsubscribe` (GET and POST), `/health`, `/stats`, `/shared/:id`. Everything else goes through the global `JwtAuthGuard`, and every blog route filters by the caller's user ID.
- **Untrusted content:** feed and page content from any website (titles, URLs, summaries). It reaches the web app, the emails, the OPML export, the public shared page and the Worker's meta tags.
- **Outbound fetches** of user-supplied URLs (the SSRF surface).

## Findings

| Severity | Finding | Status |
|---|---|---|
| Medium | **Rate limits shared by all users behind a proxy** (CWE-770, A06). `ThrottlerGuard` keys on `req.ip`, and without `trust proxy` that is the proxy's address once deployed behind Railway or Cloudflare. One person could exhaust the 5-a-minute sign-in limit for everyone. | **Fixed:** `TRUST_PROXY` env var (hop count), set in `configureApp`. The e2e test shows two clients behind one proxy get separate limits. Set it on deploy ([[Deploy checklist]]). |
| Low | **No security headers on usetidepool.app** (CWE-693, A02). No CSP, HSTS or framing protection. There was no XSS path (see below), so this is defence in depth. | **Fixed:** `web/public/_headers` adds a strict CSP (own scripts plus the theme script by hash; no `unsafe-inline` or `unsafe-eval`), HSTS, nosniff, `frame-ancestors 'none'`, Referrer-Policy and Permissions-Policy. `headers.spec.ts` guards the hash. Checked in a browser: no violations. The live check afterwards found Cloudflare injecting its Web Analytics beacon, which the policy blocked, so `static.cloudflareinsights.com` (script) and `cloudflareinsights.com` (reporting) are allowed by exact host (#43). |
| Low | **Quick add followed blogs without asking** (CWE-352, A01). Any website could link a signed-in reader to `usetidepool.app/some-site.com`, which followed it immediately, so the site's posts entered their digest. | **Fixed:** the reader now confirms ("Follow X?") first. |
| Low | **CI actions pinned by tag, token permissions implicit** (CWE-829, A03). The workflow only runs on pushes to `main`, never on fork pull requests. | **Fixed:** `permissions: contents: read`, and actions pinned to commit SHAs. |
| Low | **Sessions can't be revoked** (CWE-613, A07). The JWT lives 30 days in `localStorage`. Signing out only forgets it in that browser, and a deleted account's token still passes the guard (its requests then find nothing). | **Fixed (#46):** `User.tokenVersion` is stamped into every token and checked by the guard. Settings → Account → **Sign out everywhere** bumps it, and a deleted account's token now gets 401. |
| Low | **Dependency advisories inside the Prisma CLI** (A03). `mysql2` (bundled, unused: we're on Postgres) and `deepmerge-ts` (merges our own `prisma.config.ts`). Neither is reachable with attacker input. `npm audit fix --force` would downgrade Prisma to v6. | **Open:** update Prisma when a patched release is out. The web app has 0 advisories. |
| Info | API responses advertised `X-Powered-By: Express` and lacked `nosniff`. Not a vulnerability. | **Fixed** in `configureApp`. |

## Checked and fine
- **Stored XSS from feeds:** every stored URL passes `normalizeUrl`, which only allows `http:`/`https:` (`javascript:` and `data:` URLs are rejected). The web app has no `v-html` or `innerHTML`. Every feed value in emails is `escapeHtml`'d, and subjects hold counts only. The OPML export is escaped, and the Worker uses `HTMLRewriter.setAttribute`.
- **SSRF:** `safeFetch` allows http(s) only, checks every resolved address at connect time (no DNS rebinding), re-checks each redirect hop, blocks private, loopback, link-local, CGNAT, metadata and multicast ranges (IPv4 and IPv6, including mapped addresses), and caps size (20 MB, decompressed) and time (10 s).
- **Injection:** Prisma everywhere (raw SQL only in the test setup). `ValidationPipe` with `whitelist` + `forbidNonWhitelisted`, which also blocks mass assignment and `__proto__` payloads. `rss-parser` (sax) doesn't resolve external entities.
- **Auth:** magic-link tokens are 256-bit, stored hashed, single-use (atomic compare-and-set), expire after 15 minutes, and are limited to 5 per email per 15 minutes. Responses don't reveal whether an email has an account. Unsubscribe tokens can't sign in, and access tokens can't unsubscribe (typed JWTs, tested).
- **Access control:** every `/blogs/:id` route filters by `userId`. `/shared/:id` uses 64-bit random IDs, shows blogs only, and is off by default. The post-sign-in `next` path only goes through the in-app router.
- **Secrets:** nothing sensitive in git (`web/.env.cloudflare` holds only the public API address). CORS is limited to `FRONTEND_URL`.
