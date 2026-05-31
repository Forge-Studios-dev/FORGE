# Firebase Cost Analysis

Estimates are **Firebase-only** (USD/month). Dominant platform costs (S3 egress, Neon, Fly, Vercel, Mux) are excluded.

Assumptions: ~5% DAU, ~2 pushes/user/day, App Check on auth + analytics when enabled.

| Users | FCM pushes/mo | App Check verifications | Est. Firebase |
|-------|---------------|-------------------------|---------------|
| 100 | ~6K | ~5K | $0 (Spark) |
| 1K | ~60K | ~50K | $0–5 |
| 10K | ~600K | ~500K | $5–25 |
| 100K | ~6M | ~5M | $25–150 |
| 1M | ~60M | ~50M | $150–800 |

## Most cost-efficient architecture

- Keep Postgres, S3, Vercel, Fly as system of record
- Blaze plan for FCM Admin SDK at scale
- Skip Firestore, Hosting, Storage, Firebase Analytics

At 100K+ users, video egress and DB compute typically exceed $1K–10K/month — plan capacity there first.
