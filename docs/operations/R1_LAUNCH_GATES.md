# R1 launch gates — ops / legal execution

**Audience:** Legal, Ops, Perf, Eng lead.  
**Purpose:** Single checklist for launch blockers that **cannot close from git alone**.  
**Sequencing SSOT:** [FORGE_IMPLEMENTATION_ROADMAP.md](../FORGE_IMPLEMENTATION_ROADMAP.md) R1  
**Gap detail:** [FRESH_AUDIT_2026-09-03_MASTER.md §4a](../audits/FRESH_AUDIT_2026-09-03_MASTER.md)  
**Open backlog:** [DEFERRED_BACKLOG.md](../audits/DEFERRED_BACKLOG.md)  
**Post-merge smoke:** [POST_REAUDIT_CUTOVER.md](./POST_REAUDIT_CUTOVER.md)

In-repo engineering for scan webhook plugin, Stripe Connect code, Mux signed playback util, load-test scripts, and Neon DR runbook is **already shipped**. This file is the human execution path.

---

## Gate order (dependency)

```mermaid
flowchart TB
  csam[1 CSAM vendor webhook]
  stripe[2 Stripe live Connect]
  mux[3 Mux signing keys]
  dmca[4 USPTO DMCA agent]
  load[5 Staging load evidence]
  neon[6 Neon PITR drill]
  csam --> stripe
  mux --> stripe
  dmca --> csam
  load --> stripe
  neon --> stripe
```

Do **not** market open UGC upload at scale until **1** is green. Monetization go-live needs **2**. Private/members content needs **3**.

---

## 1. CSAM / content-safety vendor (Critical)

| | |
|--|--|
| **Owner** | Legal + eng |
| **In-repo** | `CONTENT_SCAN_PROVIDER=webhook`, fail-closed hold, ADR-012 noop ack |
| **Health** | `checks.contentScan` must become `webhook` (today: `noop_ack`) |
| **Docs** | [CONTENT_SCANNING.md](../CONTENT_SCANNING.md), ADR-009 / ADR-012 |

**Steps**

1. Legal selects vendor (Google CSAI Match / Thorn Safer / equivalent) and completes contract + NCMEC process as required.
2. Eng implements vendor adapter **or** points webhook at a thin proxy that maps vendor JSON → `{ action, categories }`.
3. Set Fly secrets (API + worker):

```bash
export CONTENT_SCAN_PROVIDER=webhook
export CONTENT_SCAN_WEBHOOK_URL='https://…'
export CONTENT_SCAN_WEBHOOK_TOKEN='…'   # optional
# Unset noop ack when webhook is live:
unset CONTENT_SCAN_ALLOW_NOOP
npm run set:fly:content-scan-secrets
npm run sync:fly:worker-secrets
```

4. Smoke: upload → hold path → Admin `/content?moderationStatus=held` + uploader notify.
5. Confirm health `contentScan=webhook`.

**Exit:** Health is `webhook`; legal owns ongoing reporting process.

---

## 2. Stripe live Connect (High)

| | |
|--|--|
| **Owner** | Ops |
| **In-repo** | Destination charges, webhooks, Connect onboarding |
| **Health** | `checks.billing` → `stripe` (not `misconfigured` / `stub`) |
| **Docs** | [STRIPE_PRODUCTION_ENABLEMENT.md](./STRIPE_PRODUCTION_ENABLEMENT.md) |

Execute that runbook end-to-end (live keys, Connect branding, Vercel `NEXT_PUBLIC_BILLING_ENABLED`, one `chargesEnabled` creator, test checkout).

**Exit:** Production membership checkout succeeds for a real Connect account.

---

## 3. Mux signing keys (High — private content)

| | |
|--|--|
| **Owner** | Ops |
| **In-repo** | Signed JWT util; URLs withheld without keys |
| **Health** | `checks.muxSigning` → `configured` (not `unsigned`) |
| **Docs** | [MEDIA.md](../MEDIA.md) § Signed playback |

```bash
# Mux dashboard → Signing Keys → Create
flyctl secrets set \
  MUX_SIGNING_KEY_ID='...' \
  MUX_SIGNING_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----' \
  -a forge-studios-api
npm run sync:fly:worker-secrets
```

Smoke: publish **unlisted** or **private** VOD → entitled viewer gets `stream.mux.com/…?token=…`; anonymous/non-entitled gets no HLS.

**Exit:** Health `muxSigning=configured`; private playback works.

---

## 4. USPTO DMCA designated agent (High — legal)

| | |
|--|--|
| **Owner** | Legal |
| **In-repo** | Copyright / strikes pipeline shipped |
| **Docs** | [LEGAL.md](../LEGAL.md), [COPYRIGHT_DMCA.md](../COPYRIGHT_DMCA.md) |

File designated agent with USPTO; publish agent contact on public legal pages.

**Exit:** Agent listed publicly; intake email monitored.

---

## 5. Staging load evidence (High — perf)

| | |
|--|--|
| **Owner** | Perf |
| **In-repo** | `npm run load-test:feed` / `:community` / `:entitlements` |
| **Docs** | [LOAD_TEST_RUNBOOK.md](./LOAD_TEST_RUNBOOK.md), [STAGING.md](./STAGING.md) |

Run on **staging**, attach report (p95, error rate, Neon connections) to the release ticket or `docs/operations/` evidence note.

**Exit:** Evidence attached before major marketing push / 50K MAU.

---

## 6. Neon PITR drill (High — cadence)

| | |
|--|--|
| **Owner** | Ops |
| **Next due** | **2026-10-22** |
| **Docs** | [DISASTER_RECOVERY.md](./DISASTER_RECOVERY.md) |
| **Script** | `bash scripts/verify-neon-dr-checklist.sh` |

**Exit:** Checklist signed with restore proof; next quarterly date booked.

---

## Optional hardening (accepted until flip)

| Item | Health / flag | Ref |
|------|---------------|-----|
| App Check | `APP_CHECK_ENABLED=true` + Firebase Admin | [FIREBASE.md](../FIREBASE.md) — health `appCheck`; fail-closed if Admin missing |
| API HA / cold start | `min_machines_running=2` | [FLY_SLO.md](./FLY_SLO.md) ADR-013 |
| Second worker | After idempotency review | ADR-013 |

---

## Verification one-liner (after each gate)

```bash
FORGE_SMOKE_API=https://api.forgestudios.net/api/v1 FORGE_SMOKE_MODE=public bash scripts/smoke-api.sh
# Honesty labels (contentScan / billing / muxSigning / appCheck / mockSubscriptions):
FORGE_API_URL=https://api.forgestudios.net/api/v1 bash scripts/verify-r1-health-honesty.sh
# Neon checklist evidence (optional):
FORGE_DR_EVIDENCE_FILE=docs/operations/evidence/neon-dr-checklist-$(date -u +%Y%m%d).txt npm run verify:neon-dr
```

Full product smoke: [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md).
