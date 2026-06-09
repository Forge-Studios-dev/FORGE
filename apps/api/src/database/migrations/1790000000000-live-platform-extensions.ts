import { MigrationInterface, QueryRunner } from 'typeorm';

export class LivePlatformExtensions1790000000000 implements MigrationInterface {
  name = 'LivePlatformExtensions1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "mature_content_acknowledged_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      ALTER TABLE "streams"
      ADD COLUMN IF NOT EXISTS "pinned_message_id" uuid
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stream_event_purchases" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "stream_id" uuid NOT NULL REFERENCES "streams"("id") ON DELETE CASCADE,
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "stripe_checkout_session_id" varchar(255),
        "stripe_payment_intent_id" varchar(255),
        "amount_cents" integer NOT NULL,
        "currency" varchar(3) NOT NULL DEFAULT 'usd',
        "status" varchar(32) NOT NULL DEFAULT 'completed',
        "purchased_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stream_event_purchases_stream_user"
      ON "stream_event_purchases" ("stream_id", "user_id")
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_stream_event_purchases_stripe_session"
      ON "stream_event_purchases" ("stripe_checkout_session_id")
      WHERE "stripe_checkout_session_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stream_analytics_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "stream_id" uuid NOT NULL REFERENCES "streams"("id") ON DELETE CASCADE,
        "recorded_at" timestamptz NOT NULL DEFAULT now(),
        "concurrent_viewers" integer NOT NULL DEFAULT 0,
        "chat_messages_per_min" integer NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stream_analytics_snapshots_stream_recorded"
      ON "stream_analytics_snapshots" ("stream_id", "recorded_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_analytics_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_event_purchases"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "pinned_message_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "mature_content_acknowledged_at"`);
  }
}
