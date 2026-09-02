# Pull request — skill-first platform

**Branch:** `feature/skill-first-platform` → `main`  
**Compare:** https://github.com/Forge-Studios-dev/FORGE/compare/main...feature/skill-first-platform

Copy the sections below into the GitHub PR description.

---

## Summary

- Add granular skill feature flags (`FEATURES_COURSES`, `FEATURES_MENTORSHIP`, `FEATURES_CHANNEL_POINTS`, `FEATURES_SKILL_ECONOMY_LMS`) with `SkillFeatureGuard` and `GET /platform/config` → `skillFeatures`.
- Restore courses MVP on web, mobile, and admin (discover, viewer, Studio builder, admin oversight).
- Add paid program Stripe checkout + webhook enroll + refund reversal (re-fulfill restores `refunded` → `completed`); fix `creators/me/*` route ordering and add `ReservedCreatorIdPipe`.
- Improve discovery (course search, featured rails, sitemap) and ship ops (`npm run smoke:skill-features`, `npm run pr:skill-platform`, manual GitHub workflow, ADRs).
- Admin skill pages gated with `AdminSkillFeatureGate` (nav already flag-aware).
- Community member surfaces: Mentorship tab (profile/matches) and Points tab (balance/redeem) on web + mobile.
- Flatten course/program API envelopes; search `type=course` consumes flat `discoverCourses`.

## Test plan

- [x] `@forge/shared-types` build + tests
- [x] API lint/build; **1583** unit tests + **69** HTTP e2e pass
- [x] Skill-focused unit + e2e (courses, programs, bundles, billing)
- [x] Web + admin production builds
- [ ] `npm run ci:local` (full gate before merge)
- [ ] `npm run smoke:skill-features` with API running and flags enabled
- [ ] Apply migration `2290000000000-program-purchases` on staging
- [ ] Staging: enable flags → verify `/discover/courses`, Studio programs tab, paid checkout (Stripe test mode)

## Post-merge (staging)

```env
FEATURES_COURSES=true
FEATURES_MENTORSHIP=true
FEATURES_CHANNEL_POINTS=true
FEATURES_SKILL_ECONOMY_LMS=true
```

```bash
npm run smoke:skill-features
```

See [SKILL_PLATFORM_SHIP_READINESS.md](./SKILL_PLATFORM_SHIP_READINESS.md).
