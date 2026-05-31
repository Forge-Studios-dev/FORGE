# Google Authentication & Account Linking

## Flow (Passport, not Firebase Auth)

1. `GET /api/v1/auth/google` → Google consent
2. `GET /api/v1/auth/google/callback` → `loginWithGoogle`
3. Match `oauth_accounts(provider, providerId)` OR `users.email`
4. Create user if new (auto `isVerified: true`)
5. Link `oauth_accounts` row if missing
6. Redirect web to `/auth/oauth/callback` with tokens

## Scenarios

| Scenario | Behavior |
|----------|----------|
| New Google user | New Postgres user + oauth row |
| Email account exists → Google login | **Links** oauth to existing user |
| Google user tries password login | `USE_GOOGLE_SIGNIN` error |
| Duplicate Google id | Same oauth row → same user |

## Not yet implemented

- Unlink Google from settings
- Password set for Google-only users (“add password”)
- Google on mobile (web redirect only today)

Firebase Google Sign-In would duplicate this — **keep Passport**.
