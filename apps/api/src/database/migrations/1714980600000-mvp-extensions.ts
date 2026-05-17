import { MigrationInterface, QueryRunner } from 'typeorm';

export class MvpExtensions1714980600000 implements MigrationInterface {
  name = 'MvpExtensions1714980600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying NOT NULL,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_password_reset_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "FK_password_reset_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_password_reset_token_hash" ON "password_reset_tokens" ("token_hash")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "reporter_id" uuid NOT NULL,
        "target_type" character varying(32) NOT NULL,
        "target_id" uuid NOT NULL,
        "reason" character varying(2000) NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'pending',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "reviewed_at" TIMESTAMPTZ,
        CONSTRAINT "PK_reports" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reports_reporter" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "watch_history" (
        "user_id" uuid NOT NULL,
        "video_id" uuid NOT NULL,
        "progress_seconds" integer NOT NULL DEFAULT 0,
        "watched_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_watch_history" PRIMARY KEY ("user_id", "video_id"),
        CONSTRAINT "FK_watch_history_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_watch_history_video" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "analytics_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "event_name" character varying(128) NOT NULL,
        "properties" jsonb,
        "user_id" uuid,
        "video_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_analytics_events" PRIMARY KEY ("id"),
        CONSTRAINT "FK_analytics_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_analytics_video" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_analytics_events_name_created" ON "analytics_events" ("event_name", "created_at")`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_token_hash" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verification_expires_at" TIMESTAMPTZ`,
    );

    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "user_agent" character varying(512)`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "device_label" character varying(200)`,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD COLUMN IF NOT EXISTS "ip_hash" character varying(128)`,
    );

    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ`,
    );
    await queryRunner.query(
      `ALTER TABLE "videos" ADD COLUMN IF NOT EXISTS "scheduled_publish_at" TIMESTAMPTZ`,
    );

    await queryRunner.query(`
      UPDATE "videos"
      SET "published_at" = COALESCE("published_at", "updated_at")
      WHERE "status" = 'ready' AND "published_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "scheduled_publish_at"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "published_at"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "ip_hash"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "device_label"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "user_agent"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verification_expires_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "email_verification_token_hash"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "analytics_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "watch_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "reports"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "password_reset_tokens"`);
  }
}
