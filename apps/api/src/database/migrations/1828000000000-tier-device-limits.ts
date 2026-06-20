import { MigrationInterface, QueryRunner } from 'typeorm';

export class TierDeviceLimits1828000000000 implements MigrationInterface {
  name = 'TierDeviceLimits1828000000000';
  transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscription_tiers"
      ADD COLUMN IF NOT EXISTS "max_concurrent_devices" integer NOT NULL DEFAULT 1
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_tiers"
      ADD CONSTRAINT "CHK_subscription_tiers_max_devices"
      CHECK ("max_concurrent_devices" >= 1 AND "max_concurrent_devices" <= 10)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "subscription_tiers"
      DROP CONSTRAINT IF EXISTS "CHK_subscription_tiers_max_devices"
    `);
    await queryRunner.query(`
      ALTER TABLE "subscription_tiers"
      DROP COLUMN IF EXISTS "max_concurrent_devices"
    `);
  }
}
