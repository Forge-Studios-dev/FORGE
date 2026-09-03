# Disaster recovery (F-901)

**Audience:** Engineering / DevOps  
**Related:** [DEPLOY.md](../DEPLOY.md) · [DEFERRED_BACKLOG.md](../audits/DEFERRED_BACKLOG.md) · [R1_LAUNCH_GATES.md](./R1_LAUNCH_GATES.md)

---

## Targets (recommended)

| Metric | Target |
|--------|--------|
| **RPO** (data loss) | ≤ 24h without PITR; ≤ minutes with Neon PITR enabled |
| **RTO** (restore service) | ≤ 4h for full API+worker redeploy from `main` |

Adjust per business requirements and Neon plan.

---

## Application rollback (no DB restore)

| Component | Action |
|-----------|--------|
| **Fly API** | `fly releases rollback -a forge-studios-api` |
| **Fly worker** | `fly releases rollback -a forge-studios-worker` |
| **Vercel web/admin** | Promote previous production deployment in dashboard |

See [DEPLOY.md](../DEPLOY.md).

---

## Database (Neon)

1. Confirm **PITR / backups** enabled on the Neon project (console → Backup).
2. Document production branch name and connection strings (pooled vs direct).
3. **Restore drill (quarterly):**
   - Create a branch from PITR timestamp in Neon.
   - Point a staging Fly app `DATABASE_URL` at the branch.
   - Run `npm run smoke:api` against staging API.
   - Delete branch after validation.

Never run destructive scripts (`scripts/wipe-platform-data.sh`) against production without explicit approval.

### Restore drill log

| Date | Restore point | Branch ready in | Data verified | RTO target met | Next due |
|------|---------------|------------------|----------------|-----------------|----------|
| 2026-07-22 | 1h before drill (06:49 UTC) | ~15s | Yes | Yes | 2026-10-22 (quarterly) |

**Checklist (non-destructive):** `npm run verify:neon-dr` · connectivity: `scripts/dr-db-verify.sh` · optional evidence: `FORGE_DR_EVIDENCE_FILE=docs/operations/evidence/neon-dr-….txt`

Method: created `br-delicate-hat-aowtvr8i` via Neon API (`POST /branches` with `parent_timestamp`) from project `orange-math-53675581` (org `org-divine-pine-40106564`), branch `br-misty-water-ao98jfuv` (production). Polled branch state until `ready`. Connected directly (Node `pg`) to both the restored branch and production, compared `information_schema.tables` count and row counts on `users`/`videos`/`member_subscriptions` — identical on both. Deleted the scratch branch immediately after verification to avoid ongoing compute/storage cost.

Closes CRIT-04 from the 2026-07-12 production readiness audit (restore had never been drilled). PITR retention on this project is 24h (`history_retention_seconds: 86400`), consistent with the documented RPO target.

---

## Redis Cloud

- Document instance tier and persistence settings in vendor console.
- Queue backlog after outage: inspect BullMQ depth via Grafana / `GET /api/v1/health` ready check.
- `scripts/flush-redis.sh` is **destructive** — dev/staging only.

---

## Media (S3 + Mux)

- **S3:** Enable versioning or lifecycle rules for the media bucket; document restore from version.
- **Mux:** Assets are vendor-hosted; re-ingest from S3 only if source keys still exist.

---

## Post-incident

1. Capture timeline (deploy, migration, vendor status).
2. Document in an internal postmortem or ops log.
3. Add monitoring gap to Grafana alerts if missing.
