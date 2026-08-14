import { MigrationInterface, QueryRunner } from 'typeorm';

export class SuperThanksFeeSnapshot1920000000000 implements MigrationInterface {
  name = 'SuperThanksFeeSnapshot1920000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "super_thanks"
      ADD COLUMN IF NOT EXISTS "platform_fee_percent" numeric(5,2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "platform_fee_cents" integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "creator_net_cents" integer NOT NULL DEFAULT 0
    `);
    // Backfill net = full amount for historical rows (fee unknown)
    await queryRunner.query(`
      UPDATE "super_thanks"
      SET "creator_net_cents" = "amount_cents"
      WHERE "creator_net_cents" = 0 AND "amount_cents" > 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "super_thanks"
      DROP COLUMN IF EXISTS "creator_net_cents",
      DROP COLUMN IF EXISTS "platform_fee_cents",
      DROP COLUMN IF EXISTS "platform_fee_percent"
    `);
  }
}
