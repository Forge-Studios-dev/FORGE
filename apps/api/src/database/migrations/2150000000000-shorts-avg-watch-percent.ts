import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backs ShortsWatchPercentService's hourly precompute — see that file for
 * why completion/rewatch (YouTube's actual Shorts ranking signal) needed a
 * cached column instead of a live per-request aggregate.
 */
export class ShortsAvgWatchPercent2150000000000 implements MigrationInterface {
  name = 'ShortsAvgWatchPercent2150000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "videos"
      ADD COLUMN IF NOT EXISTS "avg_watch_percent" double precision,
      ADD COLUMN IF NOT EXISTS "watch_percent_updated_at" timestamptz
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_shorts_watch_percent_scan"
      ON "videos" ("published_at")
      WHERE "video_type" = 'short'
        AND "status" = 'ready'
        AND "publish_status" = 'published'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_videos_shorts_watch_percent_scan"`);
    await queryRunner.query(`
      ALTER TABLE "videos"
      DROP COLUMN IF EXISTS "watch_percent_updated_at",
      DROP COLUMN IF EXISTS "avg_watch_percent"
    `);
  }
}
