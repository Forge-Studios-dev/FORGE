import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Privileged admin actions (strikes, appeals, copyright counter-notice
 * rejection, impersonation, termination) had no persisted audit trail
 * (zero-trust re-audit 2026-08-13) — this is a real gap once real DMCA/strike
 * traffic needs to be legally defensible.
 */
export class AdminAuditLog2140000000000 implements MigrationInterface {
  name = 'AdminAuditLog2140000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_log" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actor_id" uuid NOT NULL,
        "action" varchar(64) NOT NULL,
        "target_type" varchar(32) NULL,
        "target_id" varchar(64) NULL,
        "reason" text NULL,
        "metadata" jsonb NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_log_action_created_at"
      ON "admin_audit_log" ("action", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_admin_audit_log_target"
      ON "admin_audit_log" ("target_type", "target_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_log"`);
  }
}
