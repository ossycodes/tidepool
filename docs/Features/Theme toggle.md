---
status: shipped
type: feature
area: web
priority: 1
pr: 19
shipped: 2026-09-29
tags:
  - feature
---

# Theme toggle

A sun/moon button in every header (app, home, `/open`) switches between light and dark. Settings → Appearance offers System, Light or Dark.

- The choice is saved per browser in `localStorage` (`tidepool.theme`); "System" removes it and follows the device, including live changes.
- An inline script in `web/index.html` sets `data-theme` on `<html>` before first paint, so a saved theme never flashes the other one. `src/lib/theme.ts` owns the logic after that and keeps `<meta name="theme-color">` in step.
- Emails are unaffected; they follow the mail client.
