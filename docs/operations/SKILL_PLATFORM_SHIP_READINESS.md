# Skill platform ship readiness

**Status:** In-repo engineering complete (2026-09-02).  
**SSOT:** [FORGE_IMPLEMENTATION_ROADMAP.md](../FORGE_IMPLEMENTATION_ROADMAP.md) · [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md)

---

## Enable skill extensions (per environment)

Set in `apps/api/.env` and restart API:

```env
FEATURES_COURSES=true
FEATURES_MENTORSHIP=true
FEATURES_CHANNEL_POINTS=true
FEATURES_SKILL_ECONOMY_LMS=true   # programs, cohorts, paid bundles
```

Clients read `GET /platform/config` → `skillFeatures`.

---

## Validation checklist

| Step | Command |
|------|---------|
| API unit + HTTP e2e | `cd apps/api && npm test && npx jest --config test/jest-e2e.json courses-http programs-http creator-bundles-http` |
| Skill smoke (API running) | `npm run smoke:skill-features` |
| Full CI gate | `npm run ci:local` |
| Post-deploy smoke (GitHub) | Actions → **Skill features smoke** → set API URL; `expect_flags=1` in staging |

---

## Surfaces shipped (flag-gated)

| Feature | Web | Mobile | Admin |
|---------|-----|--------|-------|
| Courses MVP | `/discover/courses`, `/courses/:id`, Studio | discover, viewer, studio | `/courses` overview |
| Programs (LMS) | `/:user/programs/:slug`, Studio Programs tab | program viewer, studio | — |
| Mentorship | Studio + community | studio screen | `/mentorship` |
| Channel points | Studio | studio screen | `/channel-points` |
| Discovery | search `type=course`, home rail | feed + explore rails | — |

---

## Billing (paid programs)

- `POST /programs/:id/checkout` → Stripe Connect
- Webhook `metadata.type=program` → enroll bundled courses
- Refund/dispute → `program_purchases.status=refunded` (enrollments kept)

---

## Pre-launch blockers (external)

| Item | Reference |
|------|-----------|
| CSAM / content-scan vendor | ADR-009, `CONTENT_SCANNING.md` |
| Stripe production cutover | `STRIPE_PRODUCTION_ENABLEMENT.md` |
| Load soak before major marketing | `LOAD_TEST_RUNBOOK.md` |
| Neon DR drill | Next: 2026-10-22 |

---

## API routing note

Register `/creators/me/...` **before** `/creators/:creatorId/...`. Use `ReservedCreatorIdPipe` on public `:creatorId` routes without `ParseUUIDPipe`. See `forge-backend.mdc`.
