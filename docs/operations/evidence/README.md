# Ops evidence (R1)

Attachables for launch gates that cannot close from git alone.

| Artifact | How to produce |
|----------|----------------|
| Load soak | `FORGE_LOAD_EVIDENCE_FILE=docs/operations/evidence/load-test-feed-YYYYMMDD.txt npm run load-test:feed` |
| Health honesty | `FORGE_HEALTH_EVIDENCE_FILE=docs/operations/evidence/health-honesty-YYYYMMDD.json bash scripts/verify-r1-health-honesty.sh` |
| Neon DR checklist | `FORGE_DR_EVIDENCE_FILE=docs/operations/evidence/neon-dr-checklist-YYYYMMDD.txt npm run verify:neon-dr` |

Do **not** commit secrets or production connection strings. Prefer redacted stdout or checklist sign-off templates.

Canonical gates: [R1_LAUNCH_GATES.md](../R1_LAUNCH_GATES.md).
