import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminAuditLog1780000000002 implements MigrationInterface {
  name = 'AdminAuditLog1780000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "admin_id" uuid NOT NULL,
        "action" varchar(128) NOT NULL,
        "target_type" varchar(64),
        "target_id" varchar(128),
        "metadata" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_admin_created"
      ON "admin_audit_logs" ("admin_id", "created_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_logs"`);
  }
}
