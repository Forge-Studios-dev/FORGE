# Phase 8 — Security Risk Assessment

**Audit date:** 2026-06-04

---

## Controls in place (summary)

| Category | Implementation | Path |
|----------|----------------|------|
| Transport | HTTPS enforced (Fly, Vercel) | `fly.toml` |
| Headers | Helmet | `main.ts:51` |
| CORS | Prod allowlist | `main.ts:54-72` |
| Input validation | class-validator + whitelist pipe | DTOs, `main.ts:74-80` |
| AuthN | JWT ~15m + refresh rotation | `auth.service.ts`, `jwt.strategy.ts` |
| AuthZ | RBAC + permissions + creator guards | `roles.guard.ts`, `permissions.guard.ts` |
| Session security | HttpOnly cookies, secure in prod | `auth-cookies.ts` |
| Abuse | Throttler + Redis login lockout | `app.module.ts`, `auth-account-lockout.service.ts` |
| Bot mitigation | Firebase App Check (optional) | `app-check.guard.ts` |
| Webhooks | Mux signature + raw body | `streaming.controller.ts`, `main.ts` rawBody |
| Secrets | Prod validation rejects placeholder JWT/Mux | `validate-production-config.ts` |
| Errors | No stack to client on 500 | `http-exception.filter.ts` |
| Upload | Multer size cap 500MB | `videos.controller.ts` |
| SSRF | Playback URL allowlist | `playback-url.util.ts` |

---

## OWASP Top 10 mapping

| Risk | Status | Notes |
|------|--------|-------|
| A01 Broken Access Control | **Mostly mitigated** | Entitlements on playback; tests in `entitlements.service.spec.ts`, `videos.playback.spec.ts` |
| A02 Cryptographic Failures | **Mitigated** | bcrypt cost 12; refresh token hashed |
| A03 Injection | **Mitigated** | TypeORM parameterized; ValidationPipe |
| A04 Insecure Design | **Partial** | Mock subscriptions OK for MVP; Stripe Phase 2 |
| A05 Security Misconfiguration | **Partial** | Prod config gate strong; dev CORS `*` |
| A06 Vulnerable Components | **Mitigated** | `npm audit` job + CodeQL workflow (F-801) |
| A07 Auth Failures | **Strong** | Refresh reuse revokes all sessions |
| A08 Data Integrity | **Mitigated** | Mux webhook verification |
| A09 Logging Failures | **Good** | Pino + correlation ID; Sentry optional |
| A10 SSRF | **Mitigated** | Playback allowlist |

---

## Findings by severity

### Critical

*None identified in code review for production configuration when `validate-production-config` and Fly secrets are correctly set.*

### High

#### F-801: No automated dependency scanning in CI — **Resolved (Waves 1 & 3)**

| Field | Value |
|-------|-------|
| **Severity** | High |
| **Evidence** | Was missing from CI |
| **Resolution** | `security-audit` job (`npm audit`) + `.github/workflows/codeql.yml` |
| **Expected impact** | Faster CVE remediation |

### Medium

#### F-802: No CSRF protection for cookie-based refresh — **Resolved (Wave 3)**

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Evidence** | HttpOnly refresh cookie on web |
| **Resolution** | `forge_csrf` cookie + `X-Forge-CSRF` header (production); web client updated |
| **Expected impact** | Reduced session theft via malicious sites |

#### F-803: Sentry default PII

| Field | Value |
|-------|-------|
| **Severity** | Medium |
| **Evidence** | `instrument.ts` — `sendDefaultPii` unless `SENTRY_SEND_DEFAULT_PII=false` |
| **Recommendation** | Set false in production Fly/Vercel secrets |
| **Expected impact** | Compliance + lower data exposure |

#### F-804: Dev CORS wildcard with credentials

| Field | Value |
|-------|-------|
| **Severity** | Medium (dev only) |
| **Evidence** | `main.ts:69` — `origin: '*'` when not production |
| **Recommendation** | Document; never run production with wrong `NODE_ENV` |
| **Expected impact** | Prevents accidental misconfiguration |

### Low

#### F-805: Admin app security headers — **Resolved (Wave 1)**

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Evidence** | Admin lacked parity with web |
| **Resolution** | Security headers in `apps/admin/next.config.mjs` |
| **Expected impact** | Defense in depth for operator UI |

#### F-806: Swagger exposed if NODE_ENV wrong

| Field | Value |
|-------|-------|
| **Severity** | Low |
| **Evidence** | Swagger only when `nodeEnv !== 'production'` in `main.ts` |
| **Recommendation** | CI smoke assert `/api/docs` 404 in prod |
| **Expected impact** | API surface not leaked |

---

## Privilege escalation risks

| Vector | Mitigation |
|--------|------------|
| Admin JWT on consumer routes | `ConsumerOnlyGuard` |
| Creator without approval | `CreatorApprovedGuard` on upload/stream |
| Impersonation | Admin-only short-lived token — `auth.service.ts` |
| Socket userId spoof | JWT-only handshake |

---

## Data leakage risks

| Vector | Mitigation |
|--------|------------|
| Internal media keys in API | Mapper strips fields |
| Playback URL to non-entitled user | `hidePlayback` + null URL |
| Error stacks | Global filter |

---

## Secrets management

- `.env` gitignored; examples only in repo
- Fly/Vercel secrets via scripts and GH Actions — no secrets in logs (per docs)
- Worker secrets synced from API machine — `sync-fly-worker-secrets.sh`

**No live credentials found in repository scan.**
