import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refunds/disputes on Super Chat and Super Thanks previously had no code path
 * to reverse the creator's ledger — `charge.refunded` only matched subscription
 * charges (F-audit 2026-08-13). These columns let the webhook locate the
 * original tip row and mark it reversed instead of silently overstating
 * creator earnings forever.
 */
export class TipRefundTracking2120000000000 implements MigrationInterface {
  name = 'TipRefundTracking2120000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "stream_messages"
      ADD COLUMN IF NOT EXISTS "stripe_checkout_session_id" varchar NULL,
      ADD COLUMN IF NOT EXISTS "refunded_at" timestamptz NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stream_messages_stripe_checkout_session_id"
      ON "stream_messages" ("stripe_checkout_session_id")
      WHERE "stripe_checkout_session_id" IS NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "super_thanks"
      ADD COLUMN IF NOT EXISTS "refunded_at" timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "super_thanks"
      DROP COLUMN IF EXISTS "refunded_at"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_stream_messages_stripe_checkout_session_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "stream_messages"
      DROP COLUMN IF EXISTS "refunded_at",
      DROP COLUMN IF EXISTS "stripe_checkout_session_id"
    `);
  }
}
