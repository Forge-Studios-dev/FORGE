# Security Findings

| ID | Issue | Severity | Status |
|----|-------|----------|--------|
| S1 | JWT in localStorage + JS cookie | Critical | Partial — refresh HttpOnly; access in memory + sessionStorage |
| S2 | Middleware presence-only check | High | **Fixed** — expiry + admin reject |
| S3 | Impersonation token in URL | High | **Fixed** — hash fragment `#token=` (not sent to server) |
| S4 | MW decode without signature verify | Medium | Accepted — API authoritative |
| S5 | Signup missing `next` | Medium | **Fixed** |
| S6 | Double-encoded `next` | Medium | **Fixed** |
| S7 | Studio/upload client-only gates | Medium | Partial — upload step MW role check |
| S8 | CSRF | Low | N/A — Bearer auth |
| S9 | XSS → full session theft | Critical | Partial — refresh HttpOnly |
| S10 | Mobile tier drift | Medium | **Fixed** — parity helpers |
| S11 | Socket invalid JWT silent | Low | Open |
| S12 | Global logout all devices | Low | **Fixed** — default logout is current device; optional `allDevices` |

## Open redirect

- Login/signup use `safeReturnPath()` — blocks `//`, protocol-relative, `/login` loops.

## Recommendations

1. Move access token to memory-only (remove localStorage).
2. Impersonation: admin returns one-time code; web POSTs without query string.
3. Optional Redis JWT denylist for revoked access tokens at scale.
