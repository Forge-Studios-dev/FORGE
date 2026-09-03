# FORGE — Fresh Security Audit (2026-07-26)

**Auditor role:** Senior Security Engineer, OWASP Top 10 + platform-specific pass
**Scope:** `apps/api` (NestJS), `apps/web` + `apps/admin` (Next.js), `apps/mobile` (Flutter)
**Method:** Independent, from-scratch review. Prior audit docs in `docs/audits/*.md` (including
`AUDIT_CONTINUATION_2026-07-26.md`, applied earlier the same day) were **not** taken as ground
truth — every finding below was re-verified by reading the current on-disk source. Where a prior
fix appears effective, it is noted as a strength, not cited as an open finding.

## Method

Traced the full authentication/authorization call graph (`apps/api/src/modules/auth/**`,
`common/guards/**`, `common/decorators/**`) via `codegraph_explore`, then read each file in full.
Spot-checked ~30 security-critical files: JWT strategy/guards, refresh-token rotation, cookie/CSRF
handling, account lockout, email OTP, OAuth exchange, impersonation flow, S3 upload services
(avatars, creator resources, community media), webhook handlers (Stripe, Mux), CORS/rate-limit
config, security headers (API `helmet()`, Next.js CSP + nonce middleware), mobile token storage,
and web token storage. Ran repo-wide greps for hardcoded secrets, `dangerouslySetInnerHTML`,
`eval`/`new Function`, raw SQL string interpolation, and SSRF-prone outbound `fetch`/`axios` calls.
Checked `package-lock.json` for the actually-resolved version of security-sensitive dependencies
(not just the `package.json` range).

## Summary

No Critical or High findings. The codebase shows a mature, previously-hardened security posture:
global fail-closed authentication (`APP_GUARD` = `JwtAuthGuard` applied to every route, opt-out via
`@Public()`), signed/idempotent webhook handling, parameterized queries throughout (no raw string
interpolation found in any of 81 `createQueryBuilder` call sites), no hardcoded secrets, secure
mobile token storage (`flutter_secure_storage`), and a real CSP with per-request nonces. Findings
below are Medium/Low defense-in-depth gaps, not exploitable-today account-takeover paths.

---

## MEDIUM

### M-1: Impersonation JWT is a fully functional bearer token — bypasses session audit trail

**Category:** Broken Authentication / Insufficient Auditing (OWASP A07:2021, A09:2021)
**Files:**
- `apps/api/src/modules/auth/auth.service.ts:235-288` (`createImpersonationToken`, `consumeImpersonationToken`)
- `apps/api/src/modules/auth/strategies/jwt.strategy.ts:41-96` (`validate`)

**Current implementation:**
```ts
// auth.service.ts:247-251
const token = this.jwtService.sign(
  { sub: targetUserId, adminId, purpose: 'impersonate' },
  { secret, expiresIn: '120s' },
);
```
```ts
// auth.service.ts:277-279 — purpose is checked only in this one code path
if (payload.purpose !== 'impersonate' || !payload.sub) {
  throw new UnauthorizedException('Invalid impersonation token');
}
```
```ts
// jwt.strategy.ts:41-47 — session check is skipped whenever `sid` is absent
async validate(payload: JwtPayload): Promise<JwtPayload> {
  if (payload.sid) {
    const active = await this.authSessionCache.assertSessionActive(payload.sid, payload.sub);
    if (!active) throw new UnauthorizedException('Session revoked — sign in again');
  }
  // ...falls through to a plain lookup by payload.sub, no `purpose` check anywhere
```

**Problem:** The impersonation token is signed with the same `jwt.secret` as a normal access
token and is intended to be single-purpose (exchanged via `POST /auth/impersonate` for a real
session). But `JwtStrategy.validate()` — the function every `@UseGuards` route relies on — never
inspects `payload.purpose`. It only special-cases session revocation `if (payload.sid)`, and the
impersonation payload has no `sid`. Consequently the raw impersonation token is a **complete,
working Bearer access token** for the target user for its full 120-second lifetime: it can be sent
directly as `Authorization: Bearer <token>` to any protected endpoint, entirely skipping
`consumeImpersonationToken` (and therefore skipping session creation, `listSessions`/
`loginHistory` visibility, and revocability via logout-all).

**Why it matters / attack scenario:** Only an admin can mint this token (`admin.controller.ts:128-131`
is `@Roles(UserRole.ADMIN)`-gated and logs an `admin.impersonate` analytics event at *creation*
time), so this is not an outside-attacker privilege-escalation path. The real risk is an insider /
compromised-admin scenario: a malicious or compromised admin account can use the raw token as a
direct API credential for the target (non-admin) user, and that activity leaves **no session
record** in `refresh_token` — it won't show up in the user's own "Sessions" or "Login history" UI,
can't be revoked via "sign out everywhere," and isn't tied to the one `admin.impersonate` audit
event the same way a normal `consumeImpersonationToken` session would be. It weakens the
accountability guarantee the impersonation feature is supposed to have, and violates the project's
own stated bar ("audit logs for sensitive actions" in `forge-backend.md`).

**Recommended solution:** Reject impersonation-purpose payloads in `JwtStrategy.validate()` (throw
`UnauthorizedException` if `payload.purpose === 'impersonate'`), forcing every impersonation token
through `consumeImpersonationToken` before it can be used as an API credential. Optionally also add
a `sid`-equivalent or `jti` denylist so a consumed impersonation token can't be reused within its
120s window.

**OWASP reference:** A07:2021 – Identification and Authentication Failures; A09:2021 – Security
Logging and Monitoring Failures.
**Estimated effort:** Small (~1-2 hours: guard change + test).
**Expected impact:** Closes an audit-trail bypass for a high-privilege internal capability; no
user-facing behavior change for the legitimate flow.

---

### M-2: Cookie-based refresh CSRF check is fully disabled outside `NODE_ENV === 'production'`

**Category:** CSRF (OWASP A01:2021)
**File:** `apps/api/src/modules/auth/auth-cookies.ts:98-128`

**Current implementation:**
```ts
export function assertCookieRefreshCsrf(
  req: Request,
  configService: ConfigService,
  bodyToken?: string,
): void {
  if (bodyToken?.trim()) return;
  const nodeEnv = configService.get<string>('nodeEnv');
  if (nodeEnv !== 'production') return;   // <-- CSRF check skipped entirely
  ...
```

**Problem:** `assertCookieRefreshCsrf` is the only defense against cross-site `POST /auth/refresh`
/ `POST /auth/logout` using the ambient `forge_refresh` HttpOnly cookie (`sameSite: 'none'` in
prod). The function returns immediately — no CSRF token comparison happens at all — for any
environment where `configService.get('nodeEnv') !== 'production'`. The repo has no separate
staging `fly.toml` today, so in the current deployment topology this is a dev-only gap, but the
guard is environment-string-based rather than fail-safe: any future staging/preview deployment
that is internet-reachable and doesn't set `NODE_ENV=production` exactly (e.g. `staging`,
`preview`, unset) inherits zero CSRF protection on the cookie-based refresh/logout flow, silently.

**Why it matters:** If such an environment is ever stood up with real user cookies (even just
internal QA accounts), a malicious page could trigger a cross-site `POST` that refreshes/rotates
or logs out a victim's session using only the ambient cookie, no token required.

**Recommended solution:** Invert the default — enforce the CSRF check whenever a refresh cookie is
present, regardless of `nodeEnv`, and only relax it for an explicit, narrowly-scoped
`ALLOW_INSECURE_CSRF_DEV=true` env flag consumed exclusively in local dev bootstrapping (not just
"not literally the string `production`").

**OWASP reference:** A01:2021 – Broken Access Control (CSRF); OWASP CSRF Prevention Cheat Sheet.
**Estimated effort:** Small (~30 min).
**Expected impact:** Removes an environment-string footgun; no behavior change in current prod.

---

### M-3: No server-enforced upload size limit on presigned S3 PUT URLs

**Category:** Resource Exhaustion / Unrestricted Upload (OWASP A04:2021)
**Files:**
- `apps/api/src/modules/users/users.service.ts:95-119` (`getAvatarUploadUrl`)
- `apps/api/src/modules/creator-resources/creator-resources.service.ts:86-113` (`getUploadUrl`)
- `apps/api/src/modules/communities/community-storage.service.ts:28-53` (`getPostMediaUploadUrl`)

**Current implementation (creator-resources.service.ts:98-111, the strictest of the three):**
```ts
if (fileSizeBytes && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
  throw new BadRequestException('File exceeds 500 MB limit');
}
...
const command = new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: mimeType });
const uploadUrl = await getSignedUrl(this.presignS3, command, { expiresIn: 600 });
```

**Problem:** `fileSizeBytes` is client-reported and only used for an application-side check before
issuing the presigned URL — it is never encoded into the presigned request itself (no
`Content-Length-Range` condition, which requires a presigned POST policy rather than a presigned
`PutObjectCommand`/`getSignedUrl`). A client can request a presigned URL with a small or omitted
`fileSizeBytes`, then `PUT` an arbitrarily large object directly to S3 using that URL — the app
never sees or enforces the actual size. The avatar (`getAvatarUploadUrl`) and community post-media
(`getPostMediaUploadUrl`) paths don't even accept a `fileSizeBytes` parameter to check.

**Why it matters:** A user (or automated script hitting these authenticated endpoints repeatedly)
can drive S3 storage/egress cost with oversized uploads disguised as avatars/attachments, and
avatar uploads in particular have no size ceiling at all in the code path. This is a cost/DoS
concern, consistent with the platform's own "cost optimization is mandatory" performance rule.

**Recommended solution:** Switch these presigned uploads to S3 presigned POST policies (which
support `content-length-range` conditions enforced by S3 itself), or add a small Lambda@Edge/S3
event trigger that deletes+flags objects exceeding the intended size class immediately after
upload. At minimum, require and validate `fileSizeBytes` on all three endpoints (avatar and
community media currently don't even ask for it).

**OWASP reference:** A04:2021 – Insecure Design (unrestricted resource consumption).
**Estimated effort:** Medium (switching to POST policies touches client upload code in web/admin/mobile).
**Expected impact:** Bounds storage-cost blast radius from abusive uploads.

---

## LOW

### L-1: `image/svg+xml` permitted in creator-resources upload allowlist

**Category:** Stored XSS surface (OWASP A03:2021)
**File:** `apps/api/src/modules/creator-resources/creator-resources.service.ts:25-46`

SVG can embed `<script>`/event-handler XSS. Currently mitigated because downloads are served via a
presigned `GetObjectCommand` with `ResponseContentDisposition: attachment` (`creator-resources.service.ts:230-235`),
forcing a download rather than inline rendering — so this is not exploitable today. It's still
unnecessary attack surface (SVG isn't a natural fit for "creator resources" alongside PDFs/docs/
zips) and would become exploitable if the download path is ever changed to inline preview or the
bucket/CDN is ever configured to serve these objects directly.

**Recommendation:** Drop `image/svg+xml` from `ALLOWED_MIME_TYPES`, or sanitize SVGs
(strip `<script>`, `on*` handlers, external refs) server-side before storing.
**Effort:** Trivial. **Impact:** Removes latent stored-XSS surface.

---

### L-2: CSRF and session cookies share the parent domain `.forgestudios.net`

**Category:** Cookie scoping / subdomain trust (OWASP A05:2021 — Security Misconfiguration)
**File:** `apps/api/src/modules/auth/auth-cookies.ts:33-38, 57-69`

```ts
function sessionCookieDomain(configService: ConfigService) {
  const isProd = nodeEnv === 'production';
  const configuredDomain = configService.get<string>('auth.refreshCookieDomain')?.trim();
  return configuredDomain || (isProd ? '.forgestudios.net' : undefined);
}
```
The non-HttpOnly `forge_csrf` cookie (needed for the double-submit pattern) and the HttpOnly
session/refresh cookies are all scoped to `.forgestudios.net`. Any current or future subdomain of
`forgestudios.net` that can execute attacker-influenced JS (a compromised or lower-trust
subdomain — marketing site, docs, a future preview-deploy host, etc.) can read `forge_csrf` via
`document.cookie` and would also receive the HttpOnly cookies on same-domain requests. This is a
standard trade-off for shared-domain SSO between `web`/`admin`, not a bug per se, but worth
tracking as the number of subdomains grows.

**Recommendation:** Keep an explicit, reviewed allowlist of which subdomains are provisioned under
`forgestudios.net` and require the same security bar (CSP, no user-generated content rendering) on
all of them; consider `__Host-`-prefixed cookies scoped to the API host only if cross-subdomain SSO
requirements ever loosen.
**Effort:** N/A (process/tracking, not code). **Impact:** Reduces blast radius of a future subdomain compromise.

---

### L-3: Password-reset and email-verification links carry the token in the URL query string, not a hash fragment

**Category:** Sensitive data in URL (OWASP A02:2021 — Cryptographic Failures / data exposure)
**Files:**
- `apps/api/src/modules/auth/auth.service.ts:397-398` (`forgotPassword` → `.../reset-password?token=${rawToken}`)
- `apps/api/src/modules/auth/auth.service.ts:478-479` (`sendEmailVerification` → `.../verify-email?token=${rawToken}`)
- Contrast with `apps/api/src/modules/auth/auth.service.ts:257-258`, which deliberately uses a hash
  fragment for the impersonation link: *"Hash fragment avoids token in server logs / Referer
  (consumed client-side only)."*

**Problem:** Query-string tokens can leak via server access logs (Next.js server, any reverse
proxy/CDN logging), browser history, and `Referer` headers if the landing page loads any
third-party resource before the token is consumed. The codebase already recognizes this exact risk
and solved it for the impersonation link — the same pattern isn't applied to password-reset (1
hour validity) or email-verification (48 hour validity) links, which have materially longer
exposure windows than the 120-second impersonation link.

**Recommendation:** Route reset/verify links through a hash-fragment or POST-based consumption
pattern consistent with the impersonation flow, or at minimum ensure the landing pages load no
third-party subresources before the token is submitted (already largely true given the CSP).
**Effort:** Small. **Impact:** Reduces token-leak surface for two long-lived, security-sensitive tokens.

---

## What's already solid (verified, not re-flagged)

- **Global fail-closed auth:** `JwtAuthGuard` registered as `APP_GUARD` in `app.module.ts:301`,
  opt-out only via `@Public()` — no risk of a forgotten `@UseGuards` leaving a route open.
- **Refresh-token reuse detection:** `auth.service.ts:301-306` revokes the entire session family on
  reuse of an already-revoked refresh token.
- **Account lockout:** Redis-backed, per-email + per-IP counters, fail-closed in production
  (`auth-account-lockout.service.ts`).
- **Webhook signature verification:** Both Stripe (`billing.service.ts:158-183`, with idempotency
  keying) and Mux (`streaming.controller.ts:363-391`) verify signatures before processing.
- **No SQL injection found:** all 81 `createQueryBuilder` call sites use parameterized `.where()`
  calls; no raw string concatenation into `dataSource.query()` outside migrations.
- **No hardcoded secrets** found in a repo-wide grep for common secret-assignment patterns.
- **Mobile token storage:** `flutter_secure_storage` (Keychain/Keystore-backed), not
  `shared_preferences` (`apps/mobile/lib/features/auth/data/auth_repository.dart`).
- **Web token storage:** access token kept in memory + `sessionStorage` (not `localStorage`);
  refresh token is HttpOnly-cookie-only, never touched by JS (`apps/web/src/lib/auth-storage.ts`).
- **CSP with per-request nonce** via `apps/web/src/middleware.ts`, real `X-Frame-Options`,
  `Strict-Transport-Security` (prod), `Permissions-Policy` (`packages/shared-types/src/security-headers.ts`).
- **CORS:** explicit production allowlist (`WEB_URL`/`ADMIN_URL` + known prod hosts), explicit dev
  allowlist rather than `origin: '*'` (`apps/api/src/config/cors-origins.ts`).
- **Dependency freshness:** `next` resolves to `14.2.35` in `package-lock.json` (patches the
  CVE-2025-29927 middleware-authorization-bypass class of issue affecting earlier 14.2.x).
- **No SSRF surface found:** all outbound `fetch`/`axios` calls in the API target hardcoded
  first-party API hosts (OpenAI, Anthropic, Resend); no user-supplied-URL fetch endpoint exists
  (avatar upload is presigned-PUT based, not fetch-a-URL based).
- **IDOR spot-checks passed:** video delete/update, creator-resource update/remove/download-URL all
  gate on `resource.creatorId === requesterId` (or subscription/tier entitlement) before acting.

---

## Security Score: 8/10

**Justification:** Zero Critical, zero High findings after a full independent pass over
authentication, session management, CSRF, RBAC/guard coverage, upload handling, webhook handling,
SSRF surface, secrets, and mobile/web token storage. The three Medium findings are real gaps but
each requires a specific precondition to matter (admin-level compromise for M-1; a
non-canonical-`NODE_ENV` deployment for M-2; sustained abusive upload behavior for M-3) rather than
being exploitable by an anonymous external attacker against the current production topology. The
Low findings are hardening opportunities the team has already applied consistently in other parts
of the same codebase (e.g., the hash-fragment pattern used for impersonation links but not yet for
reset/verify links). Docking two points for: (1) the impersonation-token/session-audit gap, which
is the one finding with genuine accountability impact if the precondition is ever met, and (2) the
environment-string-gated (rather than fail-safe) CSRF check, which is a design smell independent of
whether it's exploitable in the current single-environment deployment.
