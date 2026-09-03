# Security, Privacy & Compliance — Platform Research

> **Superseded for decisions, 2026-09-03.** Dual RBAC is intentional ([ADR-014](../decisions/ADR-014-dual-rbac.md)). MFA/DSAR shipped. See latest audit.
>
> **Partially superseded, 2026-08-13.** This doc's claims of "no MFA/2FA anywhere" and "no
> self-service account deletion or data export" are **false as of today** — TOTP MFA
> (`auth-mfa.service.ts`) and self-service export/deletion (`GET/DELETE /users/me`) both shipped
> 2026-08-11. See [PLATFORM_AUDIT_2026-08-09.md](../PLATFORM_AUDIT_2026-08-09.md) for the
> corrected status and the real remaining gaps (Google-OAuth login bypassed MFA until fixed
> 2026-08-13; Google-OAuth-only accounts couldn't self-delete until fixed the same day).
> Ground-truthed against code on 2026-08-09.
> Legal/branding note: per `forge-youtube-replica.md`, this describes **functionality and UX
> patterns only** — no trademarks, proprietary names, or asset references. This document is
> operational/engineering guidance, not legal advice (same caveat as `docs/LEGAL.md`).

## 1. Overview & scope

This domain covers the platform's trust boundary and legal exposure surface:

- **Authentication** — signup/login, OAuth, session/token lifecycle, MFA, account recovery,
  lockout, device/session management.
- **Authorization / RBAC** — platform-level roles (viewer/creator/admin), per-channel
  permissions, per-community roles, permission-check enforcement points.
- **Security architecture** — transport/headers (HSTS, CSP, CORS), CSRF, rate limiting,
  secrets management, input validation/injection defense, signed-URL/media security.
- **Data retention & deletion** — account close/deletion, content orphaning, backup/log
  retention windows, cascade behavior.
- **Privacy / compliance** — lawful-basis framing, DSAR (data subject access request) handling,
  cookie/consent posture, minors/COPPA-adjacent policy, subprocessor disclosure.
- **Accessibility** — WCAG-alignment across web/admin/mobile, captions, keyboard/screen-reader
  support.

This is distinct from `docs/platform-research/moderation-safety-admin.md` (content
moderation/reports/strikes/copyright) and only lightly overlaps
`docs/platform-research/product-vision-data-model.md` (account-deletion content-orphaning,
noted there and referenced, not duplicated here).

## 2. YouTube reference model

### 2.1 Authentication & account security
- Identity is the parent Google Account, not a YouTube-specific credential — YouTube inherits
  Google's session, recovery, and risk infrastructure rather than implementing its own.
- **2-Step Verification (2SV/MFA)** is a first-class, strongly promoted feature: authenticator
  app codes, SMS/voice backup, hardware security keys, and passkeys are all supported factors.
  Creators are specifically nudged to enable it because channel takeover is a common attack.
- **Risk-based challenges**: sign-in from a new device/location triggers an additional identity
  check (recovery email/phone, "is this you" prompt on a trusted device) rather than a flat
  password-only gate. Changing a recovery factor itself triggers a fraud-review hold (the new
  factor is disabled and the account owner is given ~30 days to confirm it was them) rather than
  taking effect immediately, closing the "attacker adds their own 2FA and locks the real owner
  out" attack path.
- **Security Checkup** is a unified dashboard: active devices/sessions, recent security events,
  connected third-party apps/API grants, and recovery info — all revocable in one place.
- **Account recovery** has a bounded grace period after a recovery-factor change (~7 days) during
  which the *old* recovery factors still work, specifically to blunt account-recovery hijacking.
- OAuth/API access to a channel is itself scoped and revocable (third-party app permissions list),
  separate from interactive login sessions.

### 2.2 Authorization / RBAC
- **Platform-level**: effectively binary from a product perspective — any signed-in Google
  Account can have a channel; "creator" is not a separately gated tier the way FORGE's
  `creator_pending/approved/rejected` is (monetization eligibility, not upload/channel
  existence, is what's gated and reviewed).
- **Channel-level (the actual RBAC surface)**: a channel can be owned directly by a personal
  account or by a **Brand Account**, which supports multiple owners/managers. Two layers of
  permission exist:
  - Brand Account ownership (who can add/remove other owners — managed outside the video
    product, at the account-management surface, not inside the creator studio).
  - Studio-level roles scoped to that channel: **Manager** (near-full control: upload, edit,
    delete, publish, manage live streams/stream keys, invite/remove other managers/editors, but
    cannot delete the channel itself), **Editor** (upload/edit/publish, cannot delete published
    content or manage permissions), **Viewer** (analytics/read-only, including a "limited"
    variant that hides revenue). This lets a channel be run by a team without sharing the
    underlying account credential.
- **Internal ops/admin** is a completely separate, non-public tooling surface with its own
  authz model (not exposed to creators or documented publicly in comparable depth) — enforcement
  actions (strikes, removals) are performed by internal reviewer tooling, not the Studio RBAC
  above.
- Impersonation/support access for internal staff is logged and scoped (see
  `moderation-safety-admin.md` §2.5 for the moderation-specific detail already covered there).

### 2.3 Security architecture
- Standard hardened transport: HSTS, strict cookie flags (`Secure`, `HttpOnly`, `SameSite`),
  CSP on the main surfaces, CSRF defenses on state-changing requests.
- Signed/expiring URLs for private or paid media delivery, short-TTL and scoped so a leaked link
  degrades gracefully rather than granting permanent access; DRM-grade protection (widevine/
  fairplay-equivalent license flow) for higher-value paid/licensed content.
- Aggressive automated abuse-rate-limiting on auth endpoints, comment/chat posting, and the API
  quota system (per-project daily quota + per-method cost, hard-capped, with a request-increase
  process) — quota exhaustion fails closed, not silently degraded.
- Secrets/credentials for the OAuth/API ecosystem are managed through a developer console with
  scoped, revocable, auditable API keys/OAuth client credentials — never embedded long-lived
  secrets in client apps for anything sensitive.

### 2.4 Data retention & deletion
- Deleting the Google Account (not just "the channel") is the actual deletion unit; channel-only
  deletion is also supported and independently reversible for a bounded undo window.
- A **grace/recovery period** applies before data is unrecoverable (approximately a month for
  self-service recovery), followed by a longer tail (reported empirically around two months) for
  full purge from backups/replicas — i.e., "delete" is a state-machine transition
  (active → pending-deletion/recoverable → purged), not an instant hard delete.
- **Google Takeout** provides self-service export of a user's own data (subscriptions, playlists,
  watch/search history, comments, uploaded video metadata) in a machine-readable bundle — this is
  the portability/access-request mechanism, available proactively rather than only on manual
  support request.
- Default watch-history auto-delete retention is configurable per-account (e.g. 3/18/36 months
  or "keep until manually deleted"), a user-facing retention control rather than a fixed backend
  policy invisible to the user.
- Backups, logs, and legal-hold copies are retained on their own schedules independent of the
  user-facing deletion action — a deletion request does not have to (and cannot practically)
  reach into cold backups instantly; this is disclosed as a general practice rather than an exact
  number per data category.

### 2.5 Privacy / compliance
- A public privacy policy names the data controller, categories of data collected, legal bases
  (contract/legitimate interest/consent/legal obligation) for regions requiring it (GDPR/UK GDPR),
  and a rights section (access/correct/delete/port/object) with a route to exercise them.
- Consent banners/cookie controls are shown where legally required (EEA/UK and similar regimes),
  distinguishing essential vs. analytics/ads cookies, with granular opt-out.
- Minors/COPPA-adjacent handling: content and channels can be designated "made for kids," which
  changes what data is collected/used (e.g., disables personalized ads and certain features) for
  viewers of that content — a content-level flag with downstream data-handling consequences, not
  just a policy statement.
- A public transparency-report cadence covering government data requests and content-removal
  requests exists as an accountability mechanism.

### 2.6 Accessibility
- Captions: creator-uploaded, ASR-auto-generated (with known accuracy limits), community
  contributions historically, viewer-side customization (font/size/color/background/opacity),
  and multi-track/multi-language support per video.
- Audio description support via a secondary described-audio track for videos that have one.
- Player is keyboard-operable (play/pause/seek/caption-toggle via standard keys) and intends
  screen-reader compatibility, though independent audits find real gaps against WCAG 2.1 AA
  (focus management, control labeling, focus-visibility) — i.e., even the reference platform is
  not fully compliant, which matters for calibrating FORGE's own bar (see §3, §5).
- A formal, jurisdiction-specific accessibility plan (e.g. published for the Canadian market)
  exists as a compliance artifact in at least one regulated region, implying accessibility is
  treated as an ongoing program with public commitments in markets that require it, not a
  one-time engineering pass.

### 2.7 Scalability & failure-mode considerations
- Auth/session infrastructure must be fail-safe under Redis/cache outages (session revocation
  checks, lockout counters) — a design choice to fail closed (deny) vs. fail open (allow) is a
  explicit security/availability trade-off at scale, not an incidental detail.
- API quota systems exist precisely because auth/session/data endpoints are the most
  economically attractive DDoS/scraping targets at platform scale.
- Deletion-as-a-state-machine (not instant hard delete) exists partly *because* purging
  petabyte-scale sharded/replicated storage instantly is not physically tractable — the grace
  window is also an engineering necessity, not purely a UX kindness.
- Accessibility regressions compound at scale (every new surface/component either inherits or
  breaks keyboard/screen-reader support) — treating it as a linted, CI-gated concern (axe checks)
  scales far better than periodic manual "a11y passes."

## 3. Secondary-platform notes

- **Twitch** — session/device security is comparable, but notably supports a chat-scoped
  read-only "moderator/VIP" role distinct from full channel-editor access, and 2FA is required
  (not merely offered) to go live or use certain creator features — a "security posture gated
  behind monetization-relevant actions" pattern worth considering once FORGE ties payouts/
  monetization to creator accounts (`creator-monetization-analytics.md` domain).
- **Vimeo** — privacy-by-default is stronger out of the box (private/password-protected videos,
  domain-level embed restriction as a paid-tier feature) and its account-deletion flow is closer
  to a clean, immediate self-service action with clearer disclosed timelines than Google's — a
  reasonable "minimum credible bar" reference for FORGE's own self-service deletion UX given
  FORGE's scale doesn't yet require Google's backup-purge complexity.
- **Discord** (relevant given FORGE's community/RBAC shape leans this direction per
  `moderation-safety-admin.md` §6) — its granular per-role permission bitfield (dozens of
  independent toggle-able permissions per role, not a fixed tier ladder) is the actual model
  FORGE's community roles (owner/admin/moderator/coach/member,
  `docs/COMMUNITY-PERMISSION-MATRIX.md`) most resemble; worth naming explicitly since the current
  matrix is "display-only" (see §4) whereas Discord's equivalent is the actual enforcement path —
  a gap in FORGE's implementation, not a modeling choice.

## 4. Current FORGE state (grounded in code + existing docs)

### 4.1 What the existing docs claim
- `docs/AUTH.md` — accurate and reasonably detailed for what exists: custom JWT + Postgres
  refresh-session model (explicitly **not** Firebase Auth), opaque SHA-256-hashed rotating
  refresh tokens with reuse-detection-triggers-full-revoke, per-client storage strategy (web
  HttpOnly cookie + in-memory token, admin similar, mobile `flutter_secure_storage`), session
  list/revoke endpoints, admin impersonation as a separate scoped token purpose. Does **not**
  mention MFA/2FA anywhere (confirmed absent in code, see §4.2) or account-deletion/self-service
  data-export endpoints.
- `docs/phases/17-security/PHASE_17_SECURITY.md` — self-reports "Verified complete for baseline"
  with Helmet/CORS/CSRF/JWT-rotation/rate-limits/playback-URL-sanitizers present, and explicitly
  **defers** "Geo anomaly login alerts" and "Signed Mux playback URLs (DRM-grade)" — i.e., the
  project's own security phase doc already flags the DRM/anomaly-detection gap that this
  document also surfaces below; nothing new to add there, just confirming it's still open
  (`PHASE_17_REPORT.md` caps completion at "~80% baseline").
- `docs/phases/21-accessibility/PHASE_21_A11Y.md` / `PHASE_21_REPORT.md` — honest about scope:
  "Complete for chrome skip-link slice" only, explicitly defers "Full WCAG audit pass / axe CI
  gate," reports ~70% completion with concrete web wins (tablist keyboard patterns, live-region
  toasts, expanded axe smoke tests). **Mobile accessibility is not mentioned in either doc at
  all** — a silent gap the doc doesn't even flag as deferred (see §4.2, §5).
- `docs/LEGAL.md` — covers Terms/Privacy page hosting, `LEGAL_LAST_UPDATED` versioning discipline,
  and signup-time `acceptedTerms` acceptance. Explicitly flags Google OAuth users as **not**
  having an in-product terms-acceptance step as a known follow-up. No mention of DSAR handling,
  cookie-consent banner, or a designated privacy-request intake flow beyond an email address.
- `docs/FIREBASE.md` — clear and consistent with `AUTH.md` that Firebase is push (FCM) +
  optional App Check only, never authentication; `firebase.usesFirebaseAuth: false` is asserted
  as an invariant surfaced through `GET /platform/config`, which is a good verifiable contract.

### 4.2 What the code actually implements
- **Auth core** (`apps/api/src/modules/auth/`): `JwtStrategy` (`jwt.strategy.ts`) validates
  short-lived access JWTs, rejects any token carrying a `purpose` claim as a bearer credential
  (so impersonation/link tokens can't be replayed as sessions — solid pattern), checks a Redis
  session-active flag keyed by `sid` for instant revocation, and re-checks `isActive`/`deletedAt`
  via a cached user snapshot (`AuthUserCacheService`) with fallback to Postgres. Login/refresh/
  logout/session-list/revoke all present and match `AUTH.md`. `AuthAccountLockoutService`
  implements Redis-backed brute-force lockout (configurable max attempts/window/lockout, **fails
  closed** — throws `ServiceUnavailableException` if Redis is unreachable, a deliberate
  security-over-availability choice worth documenting explicitly since it's not obvious from
  `AUTH.md`). CSRF: `assertCookieRefreshCsrf` double-submit check on cookie-based refresh/logout.
  Redirect-target validation (`is-allowed-redirect-url.validator.ts`) restricts OAuth/checkout
  redirect targets to FORGE's own origins (`MED-02`-labeled fix, i.e. a real vulnerability class
  already found and patched once).
- **No MFA/2FA anywhere**: confirmed zero matches for `totp`/`two-factor`/`2fa`/`mfa` across
  `apps/api/src`. Password + email OTP-verification (`verify-email/otp`) and lockout are the only
  factors; there is no second factor at login for high-value accounts (creators/admins).
- **RBAC — platform tier**: `Permission` enum + `permissionsForUser()`
  (`apps/api/src/common/auth/permissions.ts`, mirrored in
  `packages/shared-types/src/access.ts`) derives a fixed permission set from
  `UserRole` (`user | creator | admin`) × `CreatorStatus` × `isVerified` × `isActive` — six
  coarse tiers (guest/viewer/creator_pending/creator_rejected/creator/admin), enforced via
  `PermissionsGuard` + `@Permissions()` decorator across ~24 call sites. This is genuinely close
  to the YouTube-analogue table the code's own comment documents (§2.2) for the
  consumer/creator split. **There is no per-channel Manager/Editor/Viewer layer** — a FORGE
  "channel" (creator account) has exactly one owner and no delegated-access model at all; this is
  a real product gap relative to YouTube's Brand Account model (see §5), not just an
  under-documentation issue.
- **RBAC — admin tier**: `UserRole.ADMIN` is all-or-nothing at the platform scope — confirmed by
  `permissionsForUser`'s `'admin'` branch returning every `Permission` including
  `MANAGE_PLATFORM`. No scoped "trust & safety reviewer" or "support" role exists (also flagged
  independently in `moderation-safety-admin.md` §5). Admin role escalation to `ADMIN` requires
  re-entering the caller's password (`assertAdminEscalationAllowed`, referenced in the
  moderation doc) — a good step-up-auth pattern that is *not* reused anywhere else high-risk
  (e.g., no step-up on account deletion, on changing recovery email, or on issuing an
  impersonation token from an already-admin session).
- **RBAC — community tier**: `docs/COMMUNITY-PERMISSION-MATRIX.md` (already read in full) is
  explicit that the 14-key permission matrix (`community-permissions.constants.ts`) is
  **display-only** — actual enforcement is coarser role-tier checks in
  `community-moderation.service.ts` (`assertModeratorAccess`/`assertAdminAccess`). This is a
  real security-relevant gap: the UI can promise a granular permission (e.g. `export_members`)
  that the backend does not actually gate independently of the coarser role check.
- **Security headers/CORS/CSRF** (`apps/api/src/main.ts`, `apps/web/src/middleware.ts`,
  `apps/admin/src/middleware.ts`): `helmet()` applied, `trust proxy` set, CORS built from an
  explicit production-origin allowlist (`productionCorsOrigins()`) that **throws at boot** if
  empty in production (fail-closed, good). CSP is built per-request with a fresh nonce
  (`buildContentSecurityPolicy` from `@forge/shared-types/security-headers`), threaded into both
  the response header and the request headers (so Next's own inline bootstrap scripts get a
  matching nonce) — a subtle correctness detail the code comments explicitly call out as
  otherwise silently breaking hydration. Admin app CSP/middleware mirrors the web app's approach
  closely (consistent implementation, no drift found).
- **Rate limiting**: `ThrottlerModule` + a custom `RedisThrottlerModule`
  (`apps/api/src/common/throttler/`) gives distributed (multi-instance-safe) rate limiting, not
  in-memory-per-process — correct choice for a horizontally-scaled API. Per-route `@Throttle()`
  overrides are applied granularly on `AuthController` (e.g. login 20/min, forgot-password
  5/hour, signup 10/min) — sensible, differentiated limits already in place, better than a single
  global limit.
- **Data deletion**: `AdminService.deleteUser` (`apps/api/src/modules/admin/admin.service.ts`)
  is the **only** deletion path found anywhere in the codebase — admin-triggered, soft-delete
  (`deletedAt` timestamp + `isActive = false`), with PII scrubbing (email → `deleted+<suffix>
  @removed.invalid`, username/displayName replaced). Refuses to delete platform-admin accounts.
  **No self-service "delete my account" endpoint exists** for users
  (`apps/api/src/modules/users/users.controller.ts` has no `DELETE /users/me`), and no data-export/
  portability endpoint exists anywhere (confirmed no export/GDPR/takeout-style route in
  `apps/api/src`, `apps/web/src`, `apps/admin/src`, `apps/mobile/lib`). `privacy.ts` §10 tells
  users to "contact privacy@forgestudios.net to exercise these rights" — i.e., the *documented*
  process is manual/support-driven, and there is no ticketing/SLA/tracking system for such
  requests visible in the codebase either.
- **Cascade/orphaning on deletion**: not defined. The anonymized user row persists
  (`user.entity.ts` cascade rules exist for `refreshTokens` etc.), but what happens to that
  user's videos/streams/community/subscriptions after deletion is unaddressed in code or docs —
  also flagged independently in `product-vision-data-model.md` line 77 (cited there as an open
  question, repeated here because it's a privacy/compliance-relevant gap, not just a data-model
  one — "right to erasure" compliance depends on this being defined).
- **Privacy settings that do exist**: `UsersService.getPrivacySettings`/`setPrivacySettings`
  (`watchHistoryPaused` only), `clearWatchHistory`/`removeWatchHistoryItem`
  (`users.controller.ts` `DELETE /users/me/watch-history[/:videoId]`) — a real, working
  YouTube-parity feature (pause/clear watch history) that's a solid foundation but the *only*
  granular privacy control implemented; no ad-personalization opt-out, no "made for kids"-style
  flag, no cookie-consent mechanism found in `apps/web/src` (no consent-banner component located).
- **Accessibility — web**: Real, verifiable progress per `PHASE_21_REPORT.md` and confirmed by
  grep (70 files with `aria-`/`role="`/skip-link patterns in `apps/web/src`): roving-tabindex
  tablists, live-region toasts, skip-to-content link in `AppShell`. Axe smoke tests exist and
  were expanded (messages/embed/playlist paths).
- **Accessibility — mobile**: **Zero** matches for `Semantics`/`accessibility`/`a11y` anywhere in
  `apps/mobile/lib` (37+ feature screens, confirmed via grep). This is a materially larger gap
  than the web side and is not mentioned as deferred in `PHASE_21_A11Y.md` at all — the phase doc
  scoped itself to web chrome and never acknowledged mobile as in-scope-but-incomplete.
- **Captions**: `Video` entity has `captionUrl` + `captionTracks` (multi-language WebVTT,
  `caption.dto.ts`) — a real, YouTube-aligned feature already built. No audio-description track
  field exists (single video/caption track model only), and no evidence of ASR-auto-generated
  captions (looks like creator-upload-only today, unconfirmed without deeper media-pipeline
  reading — flagged as an open question in §8 rather than asserted).

## 5. Gap analysis

| Gap | Severity | Current state | Target state | Recommendation |
|---|---|---|---|---|
| No MFA/2FA for any account tier | High | Password + lockout only; zero TOTP/2FA code found | At minimum optional TOTP for creator/admin accounts; consider mandatory for admin | Add a `mfa_secrets` table + TOTP enrollment/verify endpoints; gate `ADMIN` role and high-risk actions (payout changes, impersonation) behind it once present |
| No self-service account deletion or data export | High | Only admin-triggered soft delete (`AdminService.deleteUser`); `privacy.ts` directs users to email support for any rights request | `DELETE /users/me` (self-service, with confirmation + grace window) and a data-export job (`POST /users/me/export` → async bundle) | Reuse the existing soft-delete anonymization pattern from `AdminService.deleteUser` for self-service; build export as a BullMQ job per `forge-backend.md` async-work guidance, emailing a signed download link |
| Content/asset orphaning on account deletion is undefined | High (compliance) | Anonymized user row persists; videos/community/subscriptions ownership after deletion not specified in code or docs | A documented, implemented policy: e.g. videos become "Deleted user" attributed and stay up (YouTube-like) unless the deletion request explicitly requests content removal too | Add a `deletionScope` choice (`account_only` vs `account_and_content`) to the deletion flow; document the default in `docs/LEGAL.md`/`privacy.ts` §8 |
| Community permission matrix is display-only, not enforced | Medium–High | `COMMUNITY-PERMISSION-MATRIX.md` explicitly documents this; real checks are coarser role-tier gates | Either enforce the fine-grained matrix at the service layer, or stop presenting it to end users as authoritative (UI currently implies more precision than the backend delivers) | Wire `community-permissions.constants.ts` keys into `assertModeratorAccess`/`assertAdminAccess` as an allow-list check per action, not just role-tier |
| No per-channel delegated access (Manager/Editor/Viewer) | Medium | FORGE creator accounts have exactly one owner; no delegated Studio access model | A channel-scoped roles table analogous to YouTube's Manager/Editor/Viewer, letting a creator delegate upload/analytics access without sharing credentials | New `channel_collaborators` table (`channel_owner_id`, `collaborator_user_id`, `role` enum) gating `UPLOAD_VIDEO`/`VIEW_DASHBOARD` per-channel instead of only per-user globally |
| No scoped admin/support role between full `ADMIN` and regular users | Medium | Binary `UserRole.ADMIN`; also flagged in `moderation-safety-admin.md` §5 | A trust-and-safety/support-scoped role (queue + user-lookup access, no billing/infra/impersonation-issuance rights) | Extend `UserRole` or add a permissions bitset consistent with the `Permission` enum pattern already in `packages/shared-types/src/access.ts` |
| Mobile has no accessibility implementation | High | Zero `Semantics`/a11y code found across `apps/mobile/lib`; not acknowledged in `PHASE_21_A11Y.md` | Baseline Flutter `Semantics` labeling on interactive controls, screen-reader-tested critical flows (auth, watch, upload) per `forge-mobile.md`'s parity mandate | Start with auth + watch + studio-upload screens (the flows `forge-mobile.md` already calls "parity-critical"); add to CI as a tracked (not silent) deferral if not done immediately |
| No DSAR/privacy-request intake or SLA tracking | Medium | Only a mailto (`privacy@forgestudios.net`) in `privacy.ts`; no ticketing/audit trail in code | A minimal `privacy_requests` table + admin queue (access/delete/export/object), even before full self-service automation, so requests aren't lost in an inbox | Cheapest fix: `POST /privacy/requests` (public, rate-limited) + `GET/PATCH /admin/privacy-requests`, mirroring the `reports` table pattern already in the codebase |
| No cookie-consent mechanism for EEA/UK-style regimes | Medium | `privacy.ts` §7 describes cookie usage; no consent banner/component found in `apps/web/src` | A geo-aware or always-shown consent banner distinguishing essential vs. analytics cookies, matching the disclosed practice | If analytics cookies are already non-essential-only, confirm and document; if any tracking is not essential, gate it behind consent before this is a real compliance gap, not just a docs one |
| Signed/DRM-grade playback URLs deferred (repeat of internal finding) | Medium | `PHASE_17_SECURITY.md` already defers this; no change found since | Signed, short-TTL Mux playback URLs at minimum; full DRM only if paid/licensed content requires it | Not new — just confirming still open; scope to paid/membership content first per existing monetization priority |
| Geo/anomaly login alerting deferred (repeat of internal finding) | Low–Medium | Same `PHASE_17_SECURITY.md` deferral, unchanged | Basic new-device/new-location email notification on login (cheap first step short of full anomaly scoring) | `AuthAccountLockoutService`/session infra already tracks IP/UA per session (`RefreshToken.ipHash`/`userAgent`) — enough raw signal exists to build a simple "new device" email without new instrumentation |
| No step-up auth on other high-risk actions besides admin-role escalation | Low–Medium | Only `assertAdminEscalationAllowed` (password re-entry) exists, and only for role escalation | Reuse the same pattern for: account deletion, recovery-email/password change confirmation, impersonation-token issuance | Extract `assertAdminEscalationAllowed`'s pattern into a reusable guard/decorator rather than one-off |
| No "made for kids" / minors data-handling flag | Low (until targeting younger audiences) | Not present; privacy policy states service isn't directed at under-13s but has no content-level enforcement mechanism | If FORGE's "skill-first lessons" content ever targets younger learners (plausible given the course/mentorship framing — see §6), a content-level flag with downstream ad/data consequences will be needed | Flag as product-scope-dependent; do not build speculatively before product confirms audience |
| Fail-closed vs fail-open choices are inconsistent and undocumented | Low–Medium | Lockout service fails closed (good); unclear whether `JwtStrategy`'s Redis session check or `PermissionsGuard` paths fail open or closed under a Redis outage | Audit and document each auth-adjacent Redis dependency's failure mode explicitly; standardize on fail-closed for anything authorization-relevant | Add this as an explicit line item in `docs/OBSERVABILITY.md` or a new security runbook, since it's currently tribal knowledge in the code rather than documented behavior |

## 6. Conflicts / tension to surface, not resolve

- Same root tension as `moderation-safety-admin.md` §6: `docs/FORGE_PROJECT_MASTER.md`'s
  executive summary frames FORGE as a "skill-first creator platform" (lessons, live teaching,
  communities, mock memberships — with courses/cohorts/quizzes/certificates/mentorship
  elsewhere in the tracker) against `forge-youtube-replica.md`'s mandate to prefer YouTube parity
  and refactor divergences rather than extend them. This domain has its own distinct instance of
  that tension:
  - **Privacy policy scope mismatch**: `privacy.ts` (`docs/LEGAL.md`'s source of truth) describes
    data categories in pure video-platform terms — "videos you upload," "community messages,"
    "membership status" — and says nothing about **course/quiz/assessment data or mentorship
    session data**, both of which exist elsewhere in the product framing (course completion
    records and quiz responses are plausibly "educational records" with their own norms — e.g.
    FERPA-adjacent expectations in some jurisdictions if minors or formal credentialing are
    involved; mentorship could involve 1:1 video/voice sessions with their own recording-consent
    question). **This document does not decide** whether courses/quizzes/certificates/mentorship
    are in scope for FORGE at all (that's the open product question from the sibling doc) — it
    only flags that *if* they stay in scope, the current privacy policy and data-handling model
    silently ignore them, which is a gap regardless of which way the product-framing question
    resolves.
  - **RBAC shape mirrors the same fork**: FORGE's community roles (owner/admin/moderator/coach/
    member) are Discord/Twitch-shaped, not YouTube-shaped (YouTube has no per-community "coach"
    role or member-role ladder within a channel's community). This document's §5 RBAC gaps
    (per-channel Manager/Editor/Viewer, scoped admin role) are recommended *because they close
    gaps against the YouTube reference model* — but the "coach" role's continued existence is the
    same skill-first-vs-YouTube-parity fork already flagged in the moderation doc, applied here
    to permissions rather than moderation. Not re-litigated, just noted as touching this domain
    too.
  - `FORGE_PROJECT_MASTER.md`'s own line ~196 ("familiar video IA, distinct visual identity (not
    a YouTube clone)") is the same in-repo statement already cited by the sibling moderation doc
    as contradicting `forge-youtube-replica.md` directly — repeated here because it's the root
    cause of why this domain's gap analysis (§5) reads as "close the gap to YouTube" while the
    project's own executive summary explicitly disclaims being a YouTube clone.
- **Internal inconsistency independent of the YouTube-parity question**: the community
  permission matrix being "display-only" (§4.2, `COMMUNITY-PERMISSION-MATRIX.md`'s own words) is
  a correctness/security concern regardless of product framing — a UI that shows a permission
  toggle the backend doesn't enforce is a trust-boundary bug, not a product-scope debate, and
  should be treated with more urgency than the framing question above.
- `forge-core.md`'s "avoid duplicated logic" guidance applies here too: two independent
  authorization systems exist (the `Permission`/`UserRole` platform tier and the community
  role/permission-matrix system) with no shared model or bridging documentation — same
  duplication pattern the moderation doc calls out for `reports` vs. community-moderation,
  just in the authz layer instead of the moderation layer.

## 7. Recommended flows / data model / API additions

Scoped so the highest legal/security-exposure items (deletion, DSAR intake, MFA) can ship before
the larger structural items (per-channel RBAC, matrix enforcement).

### 7.1 Data model additions

```
mfa_credentials
  id                uuid PK
  user_id           uuid FK -> users, UNIQUE
  secret_encrypted  varchar(255)          -- TOTP secret, encrypted at rest
  recovery_codes    jsonb                  -- hashed one-time recovery codes
  enabled_at        timestamptz null
  created_at        timestamptz
  INDEX (user_id)

privacy_requests
  id                uuid PK
  user_id           uuid FK -> users
  request_type      enum('access','export','delete','object')
  status            enum('pending','processing','completed','rejected')
  scope             enum('account_only','account_and_content') null  -- for 'delete' only
  requested_at      timestamptz
  completed_at      timestamptz null
  handled_by        uuid FK -> users null   -- admin actor, if manual
  export_url        varchar(1000) null      -- signed, short-TTL download link
  notes             varchar(1000) null
  INDEX (user_id, status)

channel_collaborators
  id                uuid PK
  channel_owner_id  uuid FK -> users
  collaborator_id   uuid FK -> users
  role              enum('manager','editor','viewer')
  invited_by        uuid FK -> users
  invited_at        timestamptz
  accepted_at       timestamptz null
  revoked_at        timestamptz null
  UNIQUE (channel_owner_id, collaborator_id)
  INDEX (collaborator_id)   -- "channels I have access to" lookup
```

`RefreshToken` already carries `ipHash`/`userAgent`/`deviceLabel` (§4.2) — the new-device email
alert (§5) needs no new table, only a comparison against a session's prior known
`ipHash`/`userAgent` set on login.

### 7.2 Flows

**Self-service account deletion**
1. `POST /users/me/deletion-requests` — requires re-entered password (reuse the
   `assertAdminEscalationAllowed` step-up pattern) and a `scope` choice
   (`account_only` | `account_and_content`).
2. Creates a `privacy_requests` row (`request_type='delete'`, `status='pending'`) and schedules a
   BullMQ job after a short grace window (e.g. 14 days, cancellable via
   `DELETE /users/me/deletion-requests/:id` in the meantime — mirrors YouTube's undo-window
   pattern from §2.4, adapted to FORGE's scale rather than copying Google's exact 30/60-day
   figures verbatim).
3. On execution: reuse `AdminService.deleteUser`'s anonymization logic (already correct), extend
   it to branch on `scope` — `account_only` leaves videos/community content attributed to an
   anonymized "Deleted user" placeholder (YouTube-like default); `account_and_content` also soft-
   deletes the user's own videos/posts (existing `moderationStatus`/soft-delete columns, not new
   state).
4. Mark `privacy_requests.status = 'completed'`; email confirmation.

**Data export (portability)**
1. `POST /users/me/export` — rate-limited (e.g. 1/day), creates a `privacy_requests` row
   (`request_type='export'`).
2. BullMQ worker assembles a JSON/CSV bundle (profile, videos metadata, comments, watch history,
   playlists, subscriptions) from existing repositories — no new read paths needed, just
   aggregation — uploads to S3 with a short-TTL signed URL (reuse the presign pattern already used
   for avatar/banner uploads in `users.service.ts`).
3. Email the signed link; expire it after e.g. 72 hours; update `privacy_requests.export_url`/
   `status`.

**MFA enrollment**
1. `POST /auth/mfa/enroll` (authenticated) — generates TOTP secret + QR payload, returns
   provisioning URI; does not enable MFA yet.
2. `POST /auth/mfa/verify` — user submits a code from their authenticator app; on success, set
   `mfa_credentials.enabled_at`, generate and return one-time recovery codes (shown once).
3. Login flow: after password check succeeds, if `mfa_credentials.enabled_at` is set, return a
   short-lived `mfaChallengeToken` instead of full tokens; `POST /auth/mfa/challenge` consumes it
   + a TOTP code to complete login and issue normal access/refresh tokens.
4. `POST /auth/mfa/disable` — requires step-up (current password + valid TOTP code).

**Channel delegated access (Manager/Editor/Viewer)**
1. `POST /channels/me/collaborators` (owner only) — invites `collaborator_id` with a `role`.
2. Invitee accepts via `POST /channels/collaborators/:id/accept`.
3. `PermissionsGuard`/service-layer checks for `UPLOAD_VIDEO`/`VIEW_DASHBOARD` extend to also
   pass if the caller is an accepted `manager`/`editor` (upload) or any accepted collaborator
   (dashboard view) on the target channel — additive to the existing `Permission` check, not a
   replacement.
4. Owner can revoke (`DELETE /channels/me/collaborators/:id`) at any time; revoked collaborators
   lose access on next token refresh (same cache-invalidation mechanism `AuthUserCacheService`
   already uses for `isActive`/`deletedAt` changes).

**Community permission matrix enforcement (closing the display-only gap)**
1. Replace ad-hoc calls to `assertModeratorAccess`/`assertAdminAccess` at each controller action
   with a single `assertCommunityPermission(userId, communityId, permissionKey)` that looks up
   the role → permission-key mapping already defined in
   `community-permissions.constants.ts` (the source of truth the matrix already reads from) —
   this makes the existing "display" data authoritative rather than adding a second config.
2. Roll out incrementally per action (start with `export_members` and `assign_roles`, the two
   most sensitive keys) rather than a single big-bang cutover, per `forge-core.md`'s smallest-
   safe-change guidance.

### 7.3 API additions (summary)

- `POST/DELETE /users/me/deletion-requests`, `GET /users/me/deletion-requests` (status check).
- `POST /users/me/export`, `GET /users/me/export/:id` (status/poll).
- `POST /auth/mfa/enroll`, `POST /auth/mfa/verify`, `POST /auth/mfa/challenge`,
  `POST /auth/mfa/disable`.
- `POST /channels/me/collaborators`, `POST /channels/collaborators/:id/accept`,
  `DELETE /channels/me/collaborators/:id`, `GET /channels/me/collaborators`,
  `GET /channels/shared-with-me`.
- `GET/PATCH /admin/privacy-requests` (support queue for anything not fully self-service yet).
- `POST /privacy/requests` (public/manual fallback intake — cheapest possible first step if the
  full self-service flow above is deferred).

### 7.4 Web/admin/mobile UI additions
- `apps/web` account settings: "Download your data," "Delete account" (with scope choice and
  grace-window messaging), MFA enrollment under existing security/sessions settings (adjacent to
  the session-list UI `AUTH.md` already documents).
- `apps/web` Studio: "Manage channel access" panel for `channel_collaborators`, gated behind the
  channel owner only (mirrors `docs/COMMUNITY-PERMISSION-MATRIX.md`'s existing "who can do what"
  display pattern, applied to channel-level instead of community-level).
- `apps/admin`: new `privacy-requests` queue view under an existing nav group, following the same
  list/filter/bulk-action conventions as the existing `reports` admin UI.
- `apps/mobile`: baseline `Semantics` pass on auth, watch, and studio-upload screens first (the
  three flows `forge-mobile.md` already names as parity-critical), tracked as its own slice given
  the size of the gap found in §4.2.

## 8. Assumptions & open questions

**Assumptions made in this analysis:**
- FORGE is treated as US-jurisdiction-first with GDPR/UK-GDPR-style obligations as a
  secondary/international concern, consistent with `docs/LEGAL.md`'s own stated caveat that
  legal timing/scope needs qualified counsel review before regulated-market launch.
- The 14-day deletion grace window and MFA design above are illustrative defaults, not
  contractually or legally mandated numbers — product/legal should set the actual figures.
- Google's exact deletion-timeline numbers (§2.4) are reported/empirical, not officially published
  exact SLAs — treated here as directional (state-machine + grace window + longer backup tail),
  not as numbers FORGE should copy verbatim.
- The community-permission-matrix enforcement gap (§5, §7.2) is treated as a security bug worth
  fixing regardless of the YouTube-parity-vs-skill-first product question (§6), since it's a
  trust-boundary issue independent of which product framing wins.

**Open questions for product/eng/legal to resolve (not answered here per task instructions):**
1. Same root question as the sibling moderation doc: does FORGE commit to strict YouTube parity
   (in which case the Discord/Twitch-shaped community RBAC in §6 is a target for refactor), or is
   "skill-first platform" the permanent framing (in which case this doc's YouTube-parity RBAC/
   privacy recommendations should be rescoped as "inspired by" rather than "match")?
2. Are courses/quizzes/certificates/mentorship (present elsewhere in the product framing per
   `FORGE_PROJECT_MASTER.md`) actually in scope going forward? If so, who owns defining their
   privacy/retention model (educational-record-adjacent data, session-recording consent for
   mentorship) since the current privacy policy is silent on them entirely (§6)?
3. What is FORGE's actual target grace window for account deletion, and does "account_and_content"
   deletion need to cascade into paid/membership records (refund/tax implications) — a
   billing-domain question this document can't resolve alone?
4. Is MFA a near-term requirement (e.g. for creator/admin accounts specifically, given payout/
   channel-takeover risk) or a longer-term backlog item — this changes whether §7's MFA flow
   should be prioritized ahead of the RBAC/deletion work?
5. Does FORGE need a formal subprocessor list and cookie-consent banner now, or only once
   operating in a jurisdiction that legally requires it (EEA/UK) — a market-launch-sequencing
   question, not a pure engineering one?
6. Is per-channel delegated access (Manager/Editor/Viewer, §5/§7) actually a near-term product
   need, or is FORGE's single-owner-per-channel model intentional for now given its current
   creator base size?
7. Mobile accessibility (§4.2, §5) was silently out of scope in `PHASE_21_A11Y.md` — was that an
   intentional prioritization or an oversight? This affects whether it should be reframed as a
   tracked deferral (matching the doc's honest treatment of other gaps) rather than an unstated
   absence.

---

## Re-audit 2026-09-02

**Product framing:** Skill-first creator platform + YouTube mechanics (supersedes Aug 2026 YouTube-only framing).

**Key updates:** Keep skills/crafts taxonomy; keep creator approval gate; granular feature flags (`FEATURES_COURSES`, `_MENTORSHIP`, `_CHANNEL_POINTS`); courses/mentorship/points UI restore on roadmap P2–P3.

**See:** [skill-first-positioning.md](./skill-first-positioning.md), [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md), [FRESH_AUDIT_2026-09_MASTER.md](../audits/FRESH_AUDIT_2026-09_MASTER.md).
