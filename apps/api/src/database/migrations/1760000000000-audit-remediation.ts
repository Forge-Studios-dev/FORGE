import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuditRemediation1760000000000 implements MigrationInterface {
  name = 'AuditRemediation1760000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reports_status_created_at"
      ON "reports" ("status", "created_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reports_target"
      ON "reports" ("target_type", "target_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "subscription_tiers"
      ADD COLUMN IF NOT EXISTS "stripe_price_id" varchar(255) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255) NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_stripe_customer_id"
      ON "users" ("stripe_customer_id")
      WHERE "stripe_customer_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_stripe_customer_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_customer_id"`);
    await queryRunner.query(
      `ALTER TABLE "subscription_tiers" DROP COLUMN IF EXISTS "stripe_price_id"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_target"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_status_created_at"`);
  }
}
