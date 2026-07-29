import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * H-B3 (FRESH_AUDIT_2026-07-26): the moderation queue paginates pending
 * reports newest-first (`WHERE status='pending' ORDER BY created_at DESC`).
 * Without a composite index this scans the full `reports` table as the
 * queue grows. Composite (status, created_at) keeps the hot query
 * index-only ordered.
 */
export class ReportsStatusCreatedAtIndex1840000000000 implements MigrationInterface {
  name = 'ReportsStatusCreatedAtIndex1840000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reports_status_created_at"
      ON "reports" ("status", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_status_created_at"`);
  }
}
