# Production Readiness — Auth & Navigation

| Users | Assessment |
|-------|------------|
| 100 | Ready |
| 1,000 | Ready |
| 10,000 | Ready — stateless JWT + DB refresh |
| 100,000 | OK — tune `fetchMe` frequency; CDN for public RSC |
| 1,000,000 | Needs access token out of localStorage; optional JWT denylist; session UI |

## Bottlenecks

- **Middleware:** O(1) JWT decode per protected request — acceptable.
- **Cold load:** every tab calls `GET /users/me` — consider SWR cache TTL.
- **Refresh storm:** axios single-flight retry on 401 — adequate.

## Caching

- Public home/watch ISR — no auth in RSC (correct).
- Personalized feed requires Bearer — API-side caching only with user key.

## Auth scalability

- Horizontal API scaling: no sticky sessions required.
- Refresh tokens in Postgres — index on `tokenHash`, `userId`.
