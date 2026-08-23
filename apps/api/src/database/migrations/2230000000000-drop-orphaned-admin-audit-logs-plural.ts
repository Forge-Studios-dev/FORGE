import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "admin_audit_logs" (plural, created by 1780000000002-admin-audit-log.ts) is
 * a dead duplicate of "admin_audit_log" (singular, created two months later
 * by 2140000000000-admin-audit-log.ts with an incompatible schema --
 * actor_id/action varchar(64)/reason text vs. admin_id/action varchar(128)/
 * target_type). Only the singular table has a TypeORM entity
 * (common/audit/entities/admin-audit-log.entity.ts -> @Entity('admin_audit_log')).
 * Repo-wide grep confirms zero code references the plural table -- orphaned
 * schema left behind, safe to drop.
 */
export class DropOrphanedAdminAuditLogsPlural2230000000000 implements MigrationInterface {
  name = 'DropOrphanedAdminAuditLogsPlural2230000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_logs"`);
  }

  public async down(): Promise<void> {
    /* Intentionally no-op -- the table was confirmed dead/unreferenced; not worth recreating. */
  }
}
