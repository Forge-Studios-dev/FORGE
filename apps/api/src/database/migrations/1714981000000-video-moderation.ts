import { MigrationInterface, QueryRunner } from 'typeorm';

export class VideoModeration1714981000000 implements MigrationInterface {
  name = 'VideoModeration1714981000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "public"."videos_moderation_status_enum" AS ENUM('none', 'held', 'blocked');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "moderation_status" "public"."videos_moderation_status_enum" NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "moderation_note" character varying(500),
      ADD COLUMN IF NOT EXISTS "moderated_at" TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS "moderated_by" uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      DROP COLUMN IF EXISTS "moderated_by",
      DROP COLUMN IF EXISTS "moderated_at",
      DROP COLUMN IF EXISTS "moderation_note",
      DROP COLUMN IF EXISTS "moderation_status"
    `);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."videos_moderation_status_enum"`);
  }
}
