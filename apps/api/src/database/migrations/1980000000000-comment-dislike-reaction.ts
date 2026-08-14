import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommentDislikeReaction1980000000000 implements MigrationInterface {
  name = 'CommentDislikeReaction1980000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "comments"
      ADD COLUMN IF NOT EXISTS "dislike_count" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "comment_likes"
      ADD COLUMN IF NOT EXISTS "reaction" varchar(10) NOT NULL DEFAULT 'like'
    `);
    await queryRunner.query(`
      UPDATE "comment_likes" SET "reaction" = 'like' WHERE "reaction" IS NULL OR "reaction" = ''
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comment_likes_comment_reaction"
      ON "comment_likes" ("comment_id", "reaction")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_comment_likes_comment_reaction"`);
    await queryRunner.query(`
      DELETE FROM "comment_likes" WHERE "reaction" = 'dislike'
    `);
    await queryRunner.query(`
      ALTER TABLE "comment_likes" DROP COLUMN IF EXISTS "reaction"
    `);
    await queryRunner.query(`
      ALTER TABLE "comments" DROP COLUMN IF EXISTS "dislike_count"
    `);
  }
}
