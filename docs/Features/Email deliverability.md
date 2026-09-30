---
status: in-progress
type: tech-debt
area: email
priority: 1
effort: S
tags:
  - tech-debt
---

# Email deliverability

SPF, DKIM and DMARC for the sending domain; handle bounces. Required before launch — see [[Deploy checklist]].

- [x] `usetidepool.app` verified in Resend (Ireland, eu-west-1): DKIM `resend._domainkey`, SPF via the `send` subdomain, DMARC `p=none`
- [x] Production sends through Resend's HTTPS API (#49)
- [ ] Handle bounces and complaints (Resend webhooks), then tighten DMARC to `quarantine`
