# Disaster recovery (F-901)

**Audience:** Engineering / DevOps  
**Related:** [DEPLOY.md](../DEPLOY.md) · [audits/EXECUTIVE_SUMMARY.md](../audits/EXECUTIVE_SUMMARY.md)

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
