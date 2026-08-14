# Copyright / DMCA & Account Strikes

**Status:** Engineering scaffolding for a well-defined external legal process (17 U.S.C. §512), shipped 2026-08-12. **Not legal advice** — have counsel review before relying on this in production, same disclaimer as [LEGAL.md](./LEGAL.md).

---

## 1. What this is (and isn't)

This implements the DMCA notice-and-takedown / counter-notice mechanics as described in the statute, and an account strike ladder using **YouTube's own published numbers** (this project's whole direction is YouTube parity, not inventing new thresholds — see `forge-youtube-replica.md`).

**One real-world step this cannot do:** registering a **designated DMCA agent** with the U.S. Copyright Office (https://www.copyright.gov/dmca-directory/). That's a one-time filing outside code — do it before relying on the safe-harbor protection this pipeline is meant to support. Until then, `claimantEmail`/contact routing here is a functional intake, not a substitute for that registration.

## 2. Copyright notice → takedown

`POST /copyright/notices` — public (no FORGE account required, matches real-world DMCA — a rights holder shouldn't need to sign up to file a notice). Rate-limited (5/hour) to deter abuse.

Required fields mirror the statute's elements for a valid notice:

| Field | Statutory basis |
|---|---|
| `claimantName`, `claimantEmail`, `claimantAddress` | Contact info for the complaining party |
| `workDescription` | Identification of the copyrighted work claimed to be infringed |
| `infringingDescription` | Identification of the material claimed to be infringing, and its location |
| `goodFaithStatement` (must be `true`) | "Good faith belief that use ... is not authorized" |
| `accuracyStatement` (must be `true`) | Accuracy + "under penalty of perjury, authorized to act" |
| `signature` | Physical or electronic signature |

**Unlike a user report, a valid notice is itself the takedown trigger — no human moderation review step.** `CopyrightService.submitNotice`:
1. Sets the video's visibility to `PRIVATE` (previous visibility is stored and restored verbatim on reinstatement — not forced back to `PUBLIC`).
2. Issues a `COPYRIGHT`-type strike to the uploader (see §4).
3. Emits `copyright.takedown_issued`.

## 3. Counter-notice → reinstatement

`POST /copyright/notices/:id/counter-notice` — only the uploader whose video was taken down may file one.

| Field | Statutory basis |
|---|---|
| `contactInfo` | Contact info for the counter-notifier |
| `goodFaithMistakeStatement` (must be `true`) | "Good faith belief the material was removed ... as a result of mistake or misidentification" |
| `consentToJurisdiction` (must be `true`) | Consent to the claimant's federal district court jurisdiction |
| `signature` | Signature |

On a valid counter-notice, §512(g) requires reinstatement within 10–14 business days **unless the claimant informs the platform they've filed a lawsuit** — this system cannot detect a lawsuit automatically. `reinstateEligibleAt` (now + 10 business days, `business-days.util.ts`) drives an hourly BullMQ scan (`CopyrightReinstatementWorker`/`copyright-reinstatement.scheduler.ts`) that auto-reinstates the video (restoring its stored previous visibility) unless an admin has called `POST /admin/copyright/counter-notices/:id/reject` first (e.g. because the claimant reported litigation).

## 4. Account strikes

Two independent ladders (`AccountStrike.type`), matching **YouTube's own published Community Guidelines strike system**:

| Strike # (within 90 days) | Consequence |
|---|---|
| 1st | Warning |
| 2nd | 2-week upload/live-stream restriction — **enforced**: `User.uploadRestrictedUntil` is set, checked by `UploadNotRestrictedGuard` on `POST /videos/presigned-url` and `POST /streams/start` |
| 3rd | Termination **recommended** — never auto-executed. Account/channel termination stays an admin-only, deliberate action (`ESCALATION_RULES.md` §3: irreversible account actions are admin-only) |

Strikes expire after 90 days (`expiresAt`), matching YouTube's current policy for both strike types.

- `COMMUNITY_GUIDELINE` strikes: admin-issued via `POST /admin/users/:userId/strikes` — there's no automatic trigger from a user report (an unreviewed report shouldn't cost someone a strike); an admin must make the call.
- `COPYRIGHT` strikes: auto-issued by `CopyrightService.submitNotice` (see §2) — this mirrors DMCA's actual mechanism, where a valid notice itself is the trigger, not a review step.

### Appeals

`POST /account-strikes/:id/appeal` (self, must own the strike, strike must be `active`) → `PATCH /admin/strikes/:strikeId/appeal` (admin grants/denies). Granting rescinds the strike and lifts any upload restriction it caused.

## 5. What's not done

- **Designated agent registration** (see §1) — a real filing outside this codebase, blocking full DMCA safe-harbor reliance.
- No frontend UI for filing a notice, counter-notice, or appeal — API only. `legal@forgestudios.net` (see `LEGAL.md`) is the interim manual intake path referenced in the Terms of Service.
- No cross-linking between a `CopyrightNotice`/`AccountStrike` and the platform `Report`/community-moderation systems — see `PLATFORM_AUDIT_2026-08-09.md §2.1` row 4 on why those stay separate for now.
- Repeat-infringer policy (permanently terminating accounts with a pattern of copyright strikes, required for DMCA safe harbor) is implicit in the 3-strike ladder above but not separately documented as a standalone policy statement — have counsel confirm this satisfies §512(i) before relying on it.
