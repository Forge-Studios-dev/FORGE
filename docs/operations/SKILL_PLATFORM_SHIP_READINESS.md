# Skill platform ship readiness

**Status:** In-repo engineering complete (2026-09-02). Ready for PR → merge → staging flag rollout.  
**Branch:** `feature/skill-first-platform` — **6 local commits not on origin** (push blocked until GitHub auth).  
**HEAD:** `3fc989d`  
**Note:** Course/program service methods return flat payloads (no `{ data }` double-wrap under `TransformInterceptor`).  
**SSOT:** [FORGE_IMPLEMENTATION_ROADMAP.md](../FORGE_IMPLEMENTATION_ROADMAP.md) · [FORGE_PRODUCT_STRATEGY.md](../FORGE_PRODUCT_STRATEGY.md)

### Unblock push / PR (required — cannot be automated without your credentials)

Local `gh` tokens for `alpesh-champaneri` and `Forge-Studios-dev` are **invalid**; HTTPS push returns **403**.

```bash
gh auth logout -h github.com -u alpesh-champaneri   # optional cleanup
gh auth login -h github.com                          # Forge-Studios-dev collaborator
git push -u origin HEAD
npm run pr:skill-platform
```

Compare URL (after push): https://github.com/Forge-Studios-dev/FORGE/compare/main...feature/skill-first-platform  

Unpushed commits (oldest → newest):

1. `aeb7dc9` — ignore cohort enroll when LMS off  
2. `a863046` — `pr:skill-platform` npm script  
3. `a640341` — admin skill gates + refund rebuy restore  
4. `bc0051f` — flatten course/program envelopes  
5. `70fdd6d` — course search fix + web community Mentorship/Points tabs  
6. `3fc989d` — mobile community Mentorship/Points tabs + smoke  

**Open PR:** run `npm run pr:skill-platform` after auth, body from [PR_SKILL_PLATFORM.md](./PR_SKILL_PLATFORM.md).  
*(Requires repo collaborator.)*

---

## Merge gate (verified locally)

| Check | Status |
|-------|--------|
| `@forge/shared-types` build + tests | Pass |
| API lint + build | Pass |
| Skill unit tests (flags, programs, billing, pipe) | 72 pass |
| **Full API unit tests** | **1583 pass** |
| Skill HTTP e2e (courses, programs, bundles) | 13 pass |
| **Full API HTTP e2e** | **69 pass** |
| Web production build | Pass |
| Admin production build | Pass |
| Full `npm run ci:local` | Run before merge |
| `npm run smoke:skill-features` | Run with API + flags on |

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

**PR body (copy/paste):** [PR_SKILL_PLATFORM.md](./PR_SKILL_PLATFORM.md)

---

## Surfaces shipped (flag-gated)

| Feature | Web | Mobile | Admin |
|---------|-----|--------|-------|
| Courses MVP | `/discover/courses`, `/courses/:id`, Studio | discover, viewer, studio | `/courses` overview |
| Programs (LMS) | `/:user/programs/:slug`, Studio Programs tab | program viewer, studio | — |
| Mentorship | Studio + community Mentorship tab | studio + community Mentor tab | `/mentorship` |
| Channel points | Studio + community Points tab | studio + community Points tab | `/channel-points` |
| Discovery | search `type=course`, home rail | feed + explore rails | — |

---

## Billing (paid programs)

- `POST /programs/:id/checkout` → Stripe Connect
- Webhook `metadata.type=program` → enroll bundled courses
- Refund/dispute → `program_purchases.status=refunded` (enrollments kept)
- Re-purchase after refund → `fulfillPaidPurchase` restores `completed` then re-enrolls

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
