import { MigrationInterface, QueryRunner } from 'typeorm';

/** Speeds Studio realtime + per-video impression joins that filter by video_id. */
export class AnalyticsEventsVideoIdIndex2260000000000 implements MigrationInterface {
  name = 'AnalyticsEventsVideoIdIndex2260000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_analytics_events_video_name_created"
      ON "analytics_events" ("video_id", "event_name", "created_at")
      WHERE "video_id" IS NOT NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_analytics_events_video_name_created"`);
  }
}
