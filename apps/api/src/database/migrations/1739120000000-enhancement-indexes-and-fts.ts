import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnhancementIndexesAndFts1739120000000 implements MigrationInterface {
  name = 'EnhancementIndexesAndFts1739120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_watch_history_user_watched_at"
      ON "watch_history" ("user_id", "watched_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_feed_public_ready"
      ON "videos" ("created_at" DESC, "id")
      WHERE "status" = 'ready' AND "visibility" = 'public'
    `);

    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce("title", '')), 'A')
        || setweight(to_tsvector('english', coalesce("description", '')), 'B')
      ) STORED
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_search_vector_gin"
      ON "videos" USING gin ("search_vector")
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "search_vector" tsvector
      GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce("username", '')), 'A')
        || setweight(to_tsvector('simple', coalesce("display_name", '')), 'B')
      ) STORED
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_users_search_vector_gin"
      ON "users" USING gin ("search_vector")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_users_search_vector_gin"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "search_vector"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_videos_search_vector_gin"`);
    await queryRunner.query(`ALTER TABLE "videos" DROP COLUMN IF EXISTS "search_vector"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_videos_feed_public_ready"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_watch_history_user_watched_at"`);
  }
}
