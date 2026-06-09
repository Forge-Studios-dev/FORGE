import { MigrationInterface, QueryRunner } from 'typeorm';

export class LivePhase4Scale1794000000000 implements MigrationInterface {
  name = 'LivePhase4Scale1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."stream_messages_message_type_enum" AS ENUM ('chat', 'super_chat', 'system');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "stream_messages"
      ADD COLUMN IF NOT EXISTS "stream_offset_ms" bigint,
      ADD COLUMN IF NOT EXISTS "message_type" "public"."stream_messages_message_type_enum" NOT NULL DEFAULT 'chat',
      ADD COLUMN IF NOT EXISTS "amount_cents" int,
      ADD COLUMN IF NOT EXISTS "highlight_seconds" int
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stream_messages_stream_offset"
      ON "stream_messages" ("stream_id", "stream_offset_ms")
    `);

    await queryRunner.query(`
      ALTER TABLE "streams"
      ADD COLUMN IF NOT EXISTS "dvr_enabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "unique_viewer_count" int NOT NULL DEFAULT 0
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stream_clips" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "stream_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "title" varchar(200),
        "start_offset_ms" bigint NOT NULL,
        "end_offset_ms" bigint NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'ready',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stream_clips" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stream_clips_stream" FOREIGN KEY ("stream_id") REFERENCES "streams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stream_clips_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stream_clips_stream"
      ON "stream_clips" ("stream_id", "start_offset_ms")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stream_captions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "stream_id" uuid NOT NULL,
        "video_id" uuid,
        "language" varchar(16) NOT NULL DEFAULT 'en',
        "vtt_url" varchar(2000) NOT NULL,
        "source" varchar(32) NOT NULL DEFAULT 'manual',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stream_captions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_stream_captions_stream" FOREIGN KEY ("stream_id") REFERENCES "streams"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_stream_captions_video" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_stream_captions_stream"
      ON "stream_captions" ("stream_id", "language")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_captions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stream_clips"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "unique_viewer_count"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "dvr_enabled"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_stream_messages_stream_offset"`);
    await queryRunner.query(`
      ALTER TABLE "stream_messages"
      DROP COLUMN IF EXISTS "highlight_seconds",
      DROP COLUMN IF EXISTS "amount_cents",
      DROP COLUMN IF EXISTS "message_type",
      DROP COLUMN IF EXISTS "stream_offset_ms"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."stream_messages_message_type_enum"`);
  }
}
