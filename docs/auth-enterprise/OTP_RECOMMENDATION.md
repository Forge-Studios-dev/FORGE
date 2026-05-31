# OTP vs Email Link (Phase 5)

## Recommendation: **Option A — verification links** (current) + optional OTP later

| Criterion | Email links | 6-digit OTP | Both |
|-----------|-------------|-------------|------|
| Security | High (long random token, hashed) | Medium (brute-force surface) | Best UX, more code |
| UX | One click | Copy/paste friction | Redundant for most users |
| Scalability | SMTP + DB | SMTP + Redis attempts | 2x email types |
| Cost | Low | Slightly higher support | Highest |
| Complexity | **Low (shipped)** | New tables, rate limits | Highest |

## When to add OTP

- Mobile-first markets with poor mail clients
- Step-up verification for high-risk actions (payouts, account delete)
- Not required for MVP parity with YouTube consumer signup

## If OTP is added later

- Store `email_otp` hashed in Redis with 10 min TTL
- Max 5 verify attempts, 3 resends / hour
- 6 digits from CSPRNG
- Do **not** replace link verification — use OTP for 2FA step-up only
