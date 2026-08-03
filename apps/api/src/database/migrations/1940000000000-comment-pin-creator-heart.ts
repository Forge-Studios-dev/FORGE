import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentPinAndCreatorHeart1940000000000 implements MigrationInterface {
  name = 'CommentPinAndCreatorHeart1940000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "comments"
      ADD COLUMN IF NOT EXISTS "is_pinned" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "creator_hearted" boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comments_video_pinned"
      ON "comments" ("video_id", "is_pinned")
      WHERE "deleted_at" IS NULL AND "parent_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comments_video_pinned"`);
    await queryRunner.query(`
      ALTER TABLE "comments"
      DROP COLUMN IF EXISTS "creator_hearted",
      DROP COLUMN IF EXISTS "is_pinned"
    `);
  }
}
