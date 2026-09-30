---
title: Telegram alerts
tags:
  - runbook
---

# Telegram alerts

The API can post ops alerts to a Telegram chat. It's optional: without both variables, alerts are skipped. The code is in `src/alerts/`.

Alerts only send when `NODE_ENV=production` (#53). Keeping the bot token in a local `.env` is safe: a local server stays silent even when its fetch job fails on leftover test blogs.

## What you get

| Alert | When |
|---|---|
| 🚀 API started | Every boot (a deploy or restart) |
| 👋 New reader | First sign-in of an email. Masked (`j***@gmail.com`), with the total reader count |
| 📰 New blog | A blog new to Tidepool is added (not when more readers follow it), with whether it has a feed |
| ⚠️ Blog failing | Once, when a blog hits 3 failed fetches in a row (when readers start seeing "Can't reach site") |
| ✉️ Digest failed | A digest failed after its last retry. The same error is muted for 30 minutes, so a mail outage is one alert |
| 🔥 5xx | A server error, with the route pattern (`PATCH /blogs/:id`, no ids) and message. The same route and error is muted for 10 minutes |

Alerts are fire-and-forget. They have a 5-second timeout, failures are only logged, and an alert can never slow down or break a request. Everything is HTML-escaped.

## Set it up (about 2 minutes)

1. In Telegram, message **@BotFather** → `/newbot` → pick a name and a username. Copy the **token** it gives you (`123456:ABC…`).
2. Open a chat with your new bot and send it any message, such as "hi". For a group instead, add the bot to the group and send a message there.
3. Get the **chat ID**: open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser and find `"chat":{"id": …}`. Personal chats are a positive number; groups are negative (`-100…`).
4. Set both on the API host (Railway variables), never in the repo:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC…
   TELEGRAM_CHAT_ID=987654321
   ```
5. Redeploy. The 🚀 "API started" message confirms it works.

## Test it locally

Put the two variables in your local `.env` and restart the API; the 🚀 message should arrive. Signing in with a new email sends 👋.
