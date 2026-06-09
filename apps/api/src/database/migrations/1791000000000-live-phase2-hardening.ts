import { MigrationInterface, QueryRunner } from 'typeorm';

export class LivePhase2Hardening1791000000000 implements MigrationInterface {
  name = 'LivePhase2Hardening1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "streams"
      ADD COLUMN IF NOT EXISTS "mux_playback_id" varchar(255),
      ADD COLUMN IF NOT EXISTS "livekit_egress_id" varchar(255),
      ADD COLUMN IF NOT EXISTS "reminder_sent_at" timestamptz,
      ADD COLUMN IF NOT EXISTS "mux_idle_since" timestamptz
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_streams_status_scheduled_at"
      ON "streams" ("status", "scheduled_at")
      WHERE "scheduled_at" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "stream_event_purchases"
      ADD COLUMN IF NOT EXISTS "grant_source" varchar(32) NOT NULL DEFAULT 'purchase',
      ADD COLUMN IF NOT EXISTS "granted_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS "grant_note" varchar(500)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "provider" varchar(32) NOT NULL,
        "event_id" varchar(255) NOT NULL,
        "event_type" varchar(128),
        "processed_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_webhook_events_provider_event"
      ON "webhook_events" ("provider", "event_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_events"`);
    await queryRunner.query(`
      ALTER TABLE "stream_event_purchases"
      DROP COLUMN IF EXISTS "grant_note",
      DROP COLUMN IF EXISTS "granted_by_user_id",
      DROP COLUMN IF EXISTS "grant_source"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_streams_status_scheduled_at"`);
    await queryRunner.query(`
      ALTER TABLE "streams"
      DROP COLUMN IF EXISTS "mux_idle_since",
      DROP COLUMN IF EXISTS "reminder_sent_at",
      DROP COLUMN IF EXISTS "livekit_egress_id",
      DROP COLUMN IF EXISTS "mux_playback_id"
    `);
  }
}
