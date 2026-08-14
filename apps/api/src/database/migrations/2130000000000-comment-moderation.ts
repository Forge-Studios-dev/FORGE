import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Video comments previously had no moderation state: a flagged comment was
 * hard-rejected with no review path and no visibility for the author or
 * creator (zero-trust re-audit 2026-08-13). This adds a hold state so
 * flagged comments persist for video-owner review instead of vanishing.
 */
export class CommentModeration2130000000000 implements MigrationInterface {
  name = 'CommentModeration2130000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "comments"
      ADD COLUMN IF NOT EXISTS "moderation_status" varchar(16) NOT NULL DEFAULT 'none',
      ADD COLUMN IF NOT EXISTS "moderated_at" timestamptz NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comments_video_moderation_status"
      ON "comments" ("video_id", "moderation_status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_comments_video_moderation_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "comments"
      DROP COLUMN IF EXISTS "moderated_at",
      DROP COLUMN IF EXISTS "moderation_status"
    `);
  }
}
