# Monetization

**Status:** Real revenue streams unified into one summary + a read-only eligibility gate, shipped 2026-08-13. Ad revenue is explicitly **not** built — no ad network is integrated (see §4).

---

## 1. What actually moves money today

Three independent revenue streams, each with its own durable ledger:

| Stream | Ledger | Payout mechanism |
|---|---|---|
| Subscriptions (recurring) | `MemberSubscription` | Stripe Connect destination charge, `billing.stripePlatformFeePercent` retained |
| Super Chat (live tips) | `StreamMessage` (`messageType='super_chat'`) | Stripe Connect destination charge (see §2 — this was broken until 2026-08-13) |
| Super Thanks (VOD tips) | `SuperThanks` | Stripe Connect destination charge |

All three go through the creator's own Stripe Connect Express account (`StripeConnectService`) — FORGE's own DB never holds creator funds, Stripe moves money directly to the creator, minus the platform fee taken via `application_fee_amount` at charge time.

## 2. Bug fixed 2026-08-13: Super Chat had no payout path

`BillingService.createSuperChatCheckout` created a plain platform-account Stripe Checkout Session — no `connectAccountId`, no `transfer_data`, no `application_fee_amount` — unlike Super Thanks and subscriptions, which both use Connect destination charges. In production (`isBillingEnabled()` true, real checkout, not the dev-stub instant-grant path), every Super Chat tip's money went **entirely to the platform's Stripe account with zero mechanism to pay the creator anything**. `StreamMessage` also had no `platform_fee_cents`/`creator_net_cents` columns, so even the record-keeping was incomplete.

Fixed to mirror Super Thanks exactly: `createSuperChatCheckout` now requires the creator to have completed Connect onboarding (`chargesEnabled`) before accepting a Super Chat, same as Super Thanks; `createSuperChatCheckoutSession` (`stripe-payment.provider.ts`) now sets `transfer_data.destination` + `application_fee_amount`. `StreamMessage` gained `platform_fee_percent`/`platform_fee_cents`/`creator_net_cents` columns (migration `2110000000000-super-chat-fee-split.ts`), computed the same way for both the real webhook-completion path and the dev-stub instant-grant path (`StreamChatService.computeSuperChatFeeSplit`). These fee fields are **not** exposed in `toPublicStreamMessage` — they're creator/platform bookkeeping, not something other viewers should see in chat.

## 3. Unified earnings summary

`GET creators/me/earnings` (+ `/export` for CSV) — `CreatorEarningsService` rolls subscriptions (MRR from `EntitlementsService.getSubscriberAnalytics`), Super Thanks, and Super Chat into one "how much did I make" view, mirroring how YouTube Studio's revenue tab combines ads/memberships/Super Chat/Thanks into one summary. This doesn't replace each stream's own ledger/CSV export (`listReceivedSuperThanks`, etc.) — it's a rollup on top.

## 4. What's explicitly not built: ad revenue

No ad network is integrated — no ad-serving on the video player (pre-roll/mid-roll/display), no AdSense/AdMob/programmatic integration, no revenue-share percentage decided. This requires business decisions this codebase can't make on its own: which ad network, which ad formats, what revenue-share split, skippable vs non-skippable, frequency caps. `CreatorEarningsSummary.adRevenueCents` is hardcoded `0` — a placeholder so the summary's shape doesn't need to change again once a network is chosen, not a live figure.

## 5. Monetization eligibility gate

`GET creators/me/monetization/eligibility` — `MonetizationEligibilityService` checks the same published thresholds YouTube's own Partner Program uses (not invented here): **1,000 subscribers AND (4,000 public watch hours in the trailing 12 months OR 10M Shorts views in the trailing 90 days)**, plus approved creator status and no active strike-driven upload restriction (`User.uploadRestrictedUntil`, see `docs/COPYRIGHT_DMCA.md` §4).

Two metrics are approximations, documented in code:
- **Watch hours**: `SUM(watch_history.progress_seconds)` for the creator's videos. `progress_seconds` is a viewer's furthest-watched position (overwritten per rewatch), not a true cumulative watch-time counter — it's the only per-view duration signal this codebase records, and a standard proxy for aggregate watch depth.
- **Shorts views (90d)**: `SUM(video.view_count)` for Shorts *published* in the trailing 90 days, since `view_count` is a lifetime counter with no per-event timestamps — this is views on recent Shorts, not views *accrued* in the window.

This endpoint is read-only — it does not itself unlock or auto-enable anything (there's no live ad revenue for it to gate yet). It exists so a creator can see their own progress toward eligibility, same as YouTube Studio's monetization checklist.
