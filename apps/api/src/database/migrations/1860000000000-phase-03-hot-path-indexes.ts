import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 03 — align hot-path indexes with discoverable feed, likes playlist,
 * related-video anti-join, and top-level comments.
 *
 * COALESCE(timestamptz) is not IMMUTABLE in Postgres — cast via AT TIME ZONE 'UTC'
 * so the expression indexes cleanly on Neon PG17.
 */
export class Phase03HotPathIndexes1860000000000 implements MigrationInterface {
  name = 'Phase03HotPathIndexes1860000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Plain columns only — COALESCE(timestamptz) is not IMMUTABLE on PG/Neon.
    // Discoverable published rows should have published_at set; NULLS LAST matches feed sort.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_discoverable_sort"
      ON "videos" ("published_at" DESC NULLS LAST, "id" DESC)
      WHERE "status" = 'ready'
        AND "publish_status" = 'published'
        AND "visibility" = 'public'
        AND "moderation_status" = 'none'
        AND "indexed_at" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_likes_user_reaction_created"
      ON "likes" ("user_id", "reaction", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_watch_history_video_id"
      ON "watch_history" ("video_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_comments_video_top_level"
      ON "comments" ("video_id", "created_at" DESC)
      WHERE "parent_id" IS NULL AND "deleted_at" IS NULL
    `);

    // Drop duplicate name only — keep IDX_watch_history_user_watched for history lists.
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_watch_history_user_watched_at"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_watch_history_user_watched_at"
      ON "watch_history" ("user_id", "watched_at" DESC)
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_comments_video_top_level"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_watch_history_video_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_likes_user_reaction_created"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_videos_discoverable_sort"`);
  }
}
