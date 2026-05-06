import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixUuidFkColumns1714979000000 implements MigrationInterface {
  name = 'FixUuidFkColumns1714979000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert FK columns that should be UUIDs.
    await queryRunner.query(`ALTER TABLE "videos" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid`);
    await queryRunner.query(`ALTER TABLE "streams" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid`);
    await queryRunner.query(`ALTER TABLE "likes" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid`);
    await queryRunner.query(`ALTER TABLE "likes" ALTER COLUMN "video_id" TYPE uuid USING "video_id"::uuid`);
    await queryRunner.query(`ALTER TABLE "comments" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid`);
    await queryRunner.query(`ALTER TABLE "comments" ALTER COLUMN "video_id" TYPE uuid USING "video_id"::uuid`);
    await queryRunner.query(`ALTER TABLE "comments" ALTER COLUMN "parent_id" TYPE uuid USING "parent_id"::uuid`);
    await queryRunner.query(`ALTER TABLE "follows" ALTER COLUMN "follower_id" TYPE uuid USING "follower_id"::uuid`);
    await queryRunner.query(`ALTER TABLE "follows" ALTER COLUMN "following_id" TYPE uuid USING "following_id"::uuid`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid`);
    await queryRunner.query(`ALTER TABLE "playlists" ALTER COLUMN "user_id" TYPE uuid USING "user_id"::uuid`);

    // Drop the duplicate relation columns created previously by synchronize (if they exist).
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "userId"`);
    await queryRunner.query(`ALTER TABLE "streams" DROP COLUMN IF EXISTS "userId"`);
    await queryRunner.query(`ALTER TABLE "likes" DROP COLUMN IF EXISTS "userId"`);
    await queryRunner.query(`ALTER TABLE "likes" DROP COLUMN IF EXISTS "videoId"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN IF EXISTS "userId"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN IF EXISTS "videoId"`);
    await queryRunner.query(`ALTER TABLE "comments" DROP COLUMN IF EXISTS "parentId"`);
    await queryRunner.query(`ALTER TABLE "follows" DROP COLUMN IF EXISTS "followerId"`);
    await queryRunner.query(`ALTER TABLE "follows" DROP COLUMN IF EXISTS "followingId"`);
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "userId"`);

    // Ensure FK constraints exist (safe-add pattern).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_videos_user_id') THEN
          ALTER TABLE "videos" ADD CONSTRAINT "FK_videos_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
        END IF;
      END$$;
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Not safely reversible (type casts + dropped columns).
  }
}

