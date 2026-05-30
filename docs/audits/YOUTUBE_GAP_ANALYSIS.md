# YouTube Gap Analysis

| Area | YouTube | FORGE | Gap | Priority |
|------|---------|-------|-----|----------|
| Guest browse | Full | Full + AuthGate on engage | Low | — |
| For You feed | Sign-in required | `canViewPersonalizedFeed` | Low | — |
| Library / history | Sign-in | MW + empty state | Low | — |
| Studio | Separate subdomain | Same-origin `/studio` | Medium | P3 |
| Admin | Isolated | Separate app + API guard | Low | — |
| Session cookie | HttpOnly refresh | Refresh HttpOnly; access memory/sessionStorage | Low | — |
| MW validation | Server session | JWT exp + role decode | Low | Fixed |
| Modal watch | Overlay URL | Full page | High UX | P3 |
| Scroll restore | Strong | Home feed sessionStorage restore | Low | Done |
| Return URL | `continue` | `next` + `safeReturnPath` | Low | Fixed |
| Per-device logout | Yes | Default current device; optional all | Low | Done |
| Subscriptions | Core | FORGE skill model | N/A | product |

## Guest vs logged-in parity

FORGE aligns with YouTube for: home, search, watch (public), profiles, live listing, sign-in prompts on engage.

Remaining product gaps: subscription bell at scale; creator approval vs YPP; studio subdomain (infra).
