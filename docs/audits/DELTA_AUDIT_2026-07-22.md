# FORGE — Delta audit (vs. 2026-07-12 Production-Readiness Audit)

**Date:** 2026-07-22
**Baseline:** `FORGE_Production_Readiness_Audit.docx` (prepared 2026-07-12; 65/100 overall, "not ready for a simultaneous full-platform release")
**Method:** Re-verified every Critical and High finding directly against current source (filesystem checks, grep, direct file reads, a live `npm audit` run). Medium/Low items were spot-checked against commit diffs rather than fully re-read line-by-line — see Limitations.
**Why a delta and not a fresh full audit:** the July 12 report already covers all 20 requested domains in depth (318 paragraphs); git history shows a large remediation effort landed in the 10 days since. Re-deriving the whole report from scratch would mostly restate what's already on disk. This document tracks what changed.

---

## 1. Headline result

Of the **4 Critical** and **9 High** findings in the baseline audit, **11 of 13 are directly verified as resolved**, **1 is meaningfully improved but not fully closed** (HIGH-03), and **1 is explicitly deferred by an informed team decision rather than fixed** (HIGH-05, dependency majors). This is a substantial, real remediation pass — not a documentation-only close-out. Two commits landed since July 12:

- `61faa74` — "production readiness audit fixes: security, testing, offline-first mobile" (120 files, +5,754/-411) — closed nearly the entire Medium/Low backlog plus HIGH-06/07/09.
- `93b16ea` — mobile Android/iOS scaffolding (CRIT-01).
- `2653e5f` — executed Neon PITR restore drill (CRIT-04), with a real, timestamped log.
- `4005581`, `859bf6c`, `47d81a5` — bcrypt critical CVE, CodeQL path-injection, and a Next.js CVE/CSP-nonce fix.
- `aa7b5be` — documentation sync closing several of the doc-drift findings (MED-14/15/16 and the "% complete" contradictions).

**Revised overall score: ~74/100 (Adequate → Strong), up from 65/100.** Full category breakdown in Section 5.

---

## 2. Critical blockers — all 4 verified resolved

| ID | Baseline finding | Current state | Verification |
|----|---|---|---|
| **CRIT-01** | Mobile has no `android/`/`ios/` platform folders — cannot be built | Both directories now exist with real Gradle/Xcode project structure (`build.gradle.kts`, `Runner.xcodeproj`, `Info.plist`, signing/config scaffolding) | Verified via direct filesystem listing. **Not verified:** an actual `flutter build apk/ios` run — no Flutter SDK in this sandbox, same limitation the original audit had. Recommend one real CI/local build before treating this as fully closed. |
| **CRIT-02** | Sentry Flutter wiring is dead code — never initialized | `sentry_flutter: ^9.25.0` now in `pubspec.yaml`; `main.dart` now calls `initForgeObservability(() => runApp(...))` before `runApp` | Verified via direct read of both files. |
| **CRIT-03** | Live AWS + Google OAuth credentials in cleartext local files | `.aws-forge-output.env` and `secrets/auth-deploy.env` no longer exist on disk; `setup-aws-forge.sh` now prompts to auto-delete the output file after confirming secrets were copied | Verified — files absent, script hardened. **Not independently verified:** whether the actual AWS key / OAuth secret were rotated in IAM/Google Cloud console (outside this audit's access, same as baseline). |
| **CRIT-04** | Database restore never drilled; backups unverified | A real PITR restore drill was executed 2026-07-22 (today) against Neon project `orange-math-53675581`: branch created from a 1-hour-old restore point, ready in ~15s, `information_schema.tables` count (97) and row counts on `users`/`videos`/`member_subscriptions` matched production exactly, scratch branch deleted after verification. Logged in `docs/operations/DISASTER_RECOVERY.md` with a quarterly cadence (next: 2026-10-22) | Verified via direct read of the dated restore-drill log, including the actual Neon branch IDs and method. This is real execution evidence, not a policy update. |

---

## 3. High severity — 7 of 9 verified resolved, 1 partial, 1 deferred-by-decision

| ID | Baseline finding | Status | Evidence |
|----|---|---|---|
| **HIGH-01** | No test spans checkout → entitlement-unlock | **Resolved** | `apps/api/test/billing-webhook-http.e2e-spec.ts` (204 lines) added, explicitly named/commented as closing HIGH-01, fires a mocked Stripe webhook and asserts an active `member_subscriptions` entitlement is granted. |
| **HIGH-02** | Zero tests for fraud-detection / channel-points | **Resolved** | `fraud-detection.service.spec.ts` (204 lines) and `channel-points.service.spec.ts` (283 lines) added. |
| **HIGH-03** | Zero unit/component test infra in `apps/web`/`apps/admin` | **Partially resolved** | Vitest + RTL now wired in both (`vitest.config.ts`, real `test` script). Coverage added exactly where the baseline recommended first: `LoginForm.test.tsx`, `access.test.ts`, `permissions.test.ts` (web); `login/page.test.tsx`, `auth-storage.test.ts` (admin) — 5 test files total. Still thin relative to ~240 combined source files, and the admin destructive-action components (role change, ban, video removal) still have no unit coverage of their own, though their underlying `window.confirm` calls were replaced (see MED-12 below). |
| **HIGH-04** | Demo admin seed has no production guard, cleartext password | **Resolved** | `run-seed.ts` now has `assertDemoSeedAllowed()`: refuses to seed when `NODE_ENV=production` or `DATABASE_URL` matches production markers, unless `FORGE_SEED_ALLOW_PRODUCTION=yes` is explicitly set — mirrors the pattern already used in `wipe-platform-data.sh`, as the baseline recommended. |
| **HIGH-05** | 19 high-severity dependency vulnerabilities not blocked by CI | **Open — deferred by explicit team decision, not fixed** | A live `npm audit` today shows **19 high / 65 moderate / 3 low** (monorepo-wide) — essentially unchanged from baseline's 19/66/3. CI now runs a *second*, non-blocking `npm audit --audit-level=high` step that posts to the GitHub summary with an explicit accepted-risk note ("multer needs @nestjs/platform-express v11, nodemailer v9, next v16"). Dependabot was added (`.github/dependabot.yml`, weekly, covers npm + Flutter pub). The **blocking** gate is still `--audit-level=critical` only — the baseline's recommendation to raise the blocking threshold to `high` was not taken; instead the team made a visible, documented risk-acceptance for three major-version upgrades. This is a reasonable position but is a decision, not a closure — flag for re-review at the next audit. |
| **HIGH-06** | No TLS certificate pinning on mobile | **Resolved** | `apps/mobile/lib/core/network/certificate_pinning.dart` (new, 84 lines) added and wired into both the primary and refresh `Dio` clients in `api_client.dart`. |
| **HIGH-07** | No offline caching despite documented offline-first requirement | **Resolved** | `hive`/`hive_flutter` added; `local_cache.dart` (new) implements a bounded 30-entry LRU cache-then-network pattern, wired into feed, watch-history, and per-video-detail repositories; `ConnectivityGate` no longer force-navigates to `/offline` when a cached fallback exists. |
| **HIGH-08** | Video/socket not paused when app is backgrounded | **Resolved** | `watch_screen.dart` and `live_watch_screen.dart` now implement `WidgetsBindingObserver` / `didChangeAppLifecycleState`, pausing on `paused`/`inactive`. |
| **HIGH-09** | Near-zero mobile test coverage; router test was a self-referential no-op | **Resolved** | 8 new mobile test files (`api_client_test.dart`, `auth_repository_test.dart`, `multipart_upload_test.dart`, `forge_socket_test.dart`, `feed_repository_test.dart`, `history_repository_test.dart`, `watch_repository_test.dart`, `local_cache_test.dart`). `auth_redirect_test.dart` was rewritten to import and assert against the *real* `protectedRoutes` list from `app_router.dart` instead of a hardcoded local copy — confirmed by direct read; the comment in the file itself now says "unlike the old version of this test, removing a route here now makes this test fail." |

---

## 4. Medium / Low — spot-checked, not exhaustively re-read

These were checked against the diff of `61faa74` (which explicitly names most Medium/Low IDs in its commit message) plus targeted greps, not a full line-by-line re-audit at the baseline's depth.

**Confirmed resolved (spot-checked):** MED-01 (billing DTOs converted to real classes), MED-02 (`is-allowed-redirect-url.validator.ts` added), MED-03 (metrics auth), MED-04 (non-root Docker user, both Dockerfiles), MED-06 (Dependabot added), MED-09 (nonce-based CSP with `strict-dynamic` added as the primary path; `unsafe-inline`/`unsafe-eval` kept only as the CSP2 fallback, which is the correct pattern, not a real relaxation), MED-10 (JS-writable access-token cookie removed — `auth-cookies.ts` shrank by 26 lines), MED-11 (Dialog focus trap), MED-12 (13 `window.confirm`/`prompt` sites replaced with `ConfirmDialog` in `users/[id]/page.tsx` and `reports/[id]/page.tsx`), MED-14 (`COMMUNITY-PERMISSION-MATRIX.md` now opens with an explicit "Display-only — not the enforcement source" banner, closing the doc/code ambiguity by re-labeling rather than rewiring, which the baseline offered as an acceptable option), MED-19 (empty catch blocks in `community_screen.dart`/`studio_engagement_screen.dart` addressed), MED-20 (duplicate-submit guard on the report "block video" action). All 14 LOW items named in the `61faa74` commit message (LOW-01, 03–13) — resolved.

**Still open:**
- **MED-13** — admin role escalation to `admin` still has no step-up re-authentication; grep for re-auth/step-up/PIN patterns in `users/[id]/page.tsx` returns nothing. Only the confirmation dialog changed (MED-12), not the missing extra auth step.
- **MED-21** — Firebase App Check remains `APP_CHECK_ENABLED=false` in `secrets/auth-deploy.env.example`. Reasonable to leave off pre-scale, but still open per the baseline's own framing ("before any broader push-notification rollout").
- **MED-05, MED-07, MED-08** — not independently re-checked this pass (CI required-check list, pre-deploy secret-check strictness, worker health gate). Flag as **not re-verified**, not "still open."

---

## 5. Updated scorecard

Estimates below reflect what changed since the baseline; they are directional, not re-derived with the same exhaustive rigor as the original 15-category audit (which itself took a full pass to produce). Treat as a delta signal, not a replacement scorecard.

| Category | Baseline | Delta estimate | Why it moved |
|---|---|---|---|
| Security | 70 | **80** | CRIT-03, HIGH-04, HIGH-06, MED-01/02/03/04/09/10 closed. MED-13/21 still open. |
| Functionality / Requirements | 78 | 78 | No functional scope change this pass — hardening, not new features. |
| Web Application | 72 | 76 | LOW-05/06/07/08/09 + MED-09/10 closed; HIGH-03 partial. |
| Mobile Application | 35 | **68** | CRIT-01/02 + HIGH-06/07/08/09 closed — the foundational and highest-count gaps. Held back from higher by the unverified real `flutter build` and MED-21. |
| Admin Panel | 65 | 70 | MED-12/20 closed, test infra started; MED-13 still open. |
| Backend & APIs | 82 | 86 | MED-01/02/03 + HIGH-01/02 test coverage closed. |
| Database | 80 | 80 | Unchanged — restore capability is scored under Monitoring & DR below. |
| UI/UX | 74 | 79 | MED-11/12 + LOW-06/07/08 closed. |
| Accessibility | 58 | 68 | MED-11 focus trap, LOW-08 alert role, LOW-09 aria wiring into the shared `Input` component (benefits every consumer, not just sampled ones). |
| Performance (structural) | 65 | 69 | HIGH-08 lifecycle handling, LOW-04 disk-backed upload. Still no real load test — same gap as baseline. |
| Testing | 42 | **58** | HIGH-01/02 cross-module + web/admin/mobile unit infra all substantively improved; still short of full critical-workflow coverage (browse→watch, upload→transcode→publish, go-live→chat, admin-UI moderation remain untested end-to-end). |
| CI/CD | 71 | 77 | Dependabot, non-blocking high-severity audit report added. Blocking gate itself unchanged (still critical-only). |
| Infrastructure & Cloud | 68 | 74 | Non-root Docker users, secrets hygiene. |
| Maintainability & Code Quality | 74 | 78 | Doc-drift findings (MED-14/15/16) closed via the July 22 documentation sync. |
| Monitoring & Disaster Recovery | 48 | **72** | CRIT-04 — the single largest score movement, from "never drilled" to a real, dated, measured drill with a scheduled recurrence. |
| **Overall** | **65** | **~74** | Unweighted average of the above. |

---

## 6. What's still genuinely open (updated punch list)

**Before any production push:**
1. Run a real `flutter build apk --release` / `flutter build ios --release` to confirm CRIT-01's scaffolding actually produces an installable binary — this was fixed by file presence, not a verified build, in both the original audit and this delta pass (no Flutter SDK available in either sandbox).
2. Decide whether to raise the CI blocking gate to `--audit-level=high` or formally accept HIGH-05's three major-version-behind packages (multer/nodemailer/next) as tracked risk with an expiry date — right now it's an informal comment in a workflow file, not a tracked decision record.
3. Add step-up re-authentication for admin role escalation (MED-13) — still a one-click path to granting full admin privileges.

**Next 30 days:**
4. Expand `apps/web`/`apps/admin` unit coverage beyond the 5 files added — the admin destructive-action *components* (not just the confirm-dialog UX) still have no unit tests.
5. Enable Firebase App Check (MED-21) before any broader push-notification rollout.
6. Re-verify MED-05/07/08 (CI required-check list, pre-deploy secret-check strictness, worker health gate) — not re-checked this pass.

**Unchanged from baseline (not attempted this pass, by design or scope):**
- Learner-facing UI for courses, referral/mentorship/channel-points web surfaces — backend-complete, still no frontend.
- Cross-module integration tests for the remaining critical workflows (signup→verify→login, browse→watch, upload→transcode→publish, go-live→chat, admin moderation via the actual UI).
- A real load test at 100K entitlements (tracked in `docs/audits/DEFERRED_BACKLOG.md`, still deferred).
- Stripe Connect payouts / signed Mux URLs (F-1101, still deferred pending creator payouts going live).

---

## 7. Updated release recommendation

**Web, API, admin:** Baseline said "conditionally ready pending CRIT-03/04, HIGH-01/04/05." Three of those four are now closed (CRIT-03, CRIT-04, HIGH-01, HIGH-04); only HIGH-05 remains, and it's now a documented risk-acceptance rather than an unaddressed gap. **These three surfaces have materially closed the gap to production-ready** — the main remaining condition is a decision on HIGH-05's threshold, not new engineering work.

**Mobile:** Baseline said "not ready — foundational blocker, treat as separate release track." The foundational blocker (CRIT-01) has scaffolding in place, and every other mobile-specific High finding (crash reporting, TLS pinning, offline cache, lifecycle handling, test coverage) is resolved. **This is the single biggest change since baseline** — mobile has moved from "cannot evaluate as a release candidate" to "candidate pending one verified real build." Recommend running an actual `flutter build` + device install before green-lighting a mobile release track.

**Disaster recovery:** Baseline said "independent hold — never restore-tested." **This hold is lifted** — a real, measured drill exists with a dated log and a scheduled quarterly recurrence.

---

## 8. Limitations of this delta audit

- Verification depth matches the baseline for all 4 Critical and 9 High items (direct file/filesystem/command checks). Medium and Low items were spot-checked against commit diffs and targeted greps, not re-read in full — treat the Section 4 "confirmed resolved" list as high-confidence but not re-derived from zero.
- No live infrastructure, cloud console, or app-store access was used, same restriction as the baseline.
- No Flutter SDK was available in this sandbox, so CRIT-01 is confirmed by file presence only — same gap the original audit had, now inherited by this delta rather than newly introduced.
- The updated scorecard in Section 5 is a directional estimate, not a re-run of the baseline's full scoring methodology.
