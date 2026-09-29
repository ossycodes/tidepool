---
title: Design system
tags:
  - design
---

# Design system

Tidepool is a calm weekly ritual, so the UI is **editorial**, not dashboard-like.
The weekly digest is treated as a numbered *issue* with a masthead, on the web
and in email.

- **Type:** Newsreader (display, serif) and Inter (UI).
- **Colour:** warm paper and ink, one sea-glass teal accent (`#0f766e`);
  amber and rose only for status. Light and dark themes.
- **Tokens:** `web/src/styles/tokens.css`. Emails copy them into `COLORS` in
  `src/mail/templates.ts` — keep the two in sync.
- **Components:** `web/src/components/ui/` — button, spinner, toaster, switch,
  segmented control, menu, monogram, logo.
- **Rules we follow:** rules and sheets instead of nested cards; explicit
  transition properties; tabular numbers; 44px hit areas; optimistic updates
  with undo; everything tested at 390px and in dark mode.
- **Brand assets:** `docs/brand/` (X avatar and its SVG).

![[screenshots/email-digest.png|420]]
