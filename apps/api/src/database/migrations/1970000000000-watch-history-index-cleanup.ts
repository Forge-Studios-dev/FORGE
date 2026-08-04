import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 03 follow-up: Neon had duplicate (user_id, watched_at DESC) indexes.
 * Keep IDX_watch_history_user_watched; drop the older alternate name if present.
 * Also ensure video_id index exists for related-video anti-joins.
 */
export class WatchHistoryIndexCleanup1970000000000 implements MigrationInterface {
  name = 'WatchHistoryIndexCleanup1970000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_watch_history_user_watched"
      ON "watch_history" ("user_id", "watched_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_watch_history_video_id"
      ON "watch_history" ("video_id")
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "public"."IDX_watch_history_user_watched_at"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_watch_history_user_watched_at"
      ON "watch_history" ("user_id", "watched_at" DESC)
    `);
  }
}
