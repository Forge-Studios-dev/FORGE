import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportSeverity2090000000000 implements MigrationInterface {
  name = 'ReportSeverity2090000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "reports"
      ADD COLUMN IF NOT EXISTS "reason_category" varchar(64) NULL,
      ADD COLUMN IF NOT EXISTS "severity" varchar(8) NOT NULL DEFAULT 'p3'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reports_status_severity_created_at"
      ON "reports" ("status", "severity", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_status_severity_created_at"`);
    await queryRunner.query(`
      ALTER TABLE "reports"
      DROP COLUMN IF EXISTS "severity",
      DROP COLUMN IF EXISTS "reason_category"
    `);
  }
}
