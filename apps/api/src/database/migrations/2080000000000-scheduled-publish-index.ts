import { MigrationInterface, QueryRunner } from 'typeorm';

/** Partial index for the scheduled-publish backup scan (delayed jobs are the primary path). */
export class ScheduledPublishIndex2080000000000 implements MigrationInterface {
  name = 'ScheduledPublishIndex2080000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_pending_scheduled_index"
      ON "videos" ("scheduled_publish_at")
      WHERE "status" = 'ready'
        AND "publish_status" = 'published'
        AND "visibility" = 'public'
        AND "moderation_status" = 'none'
        AND "indexed_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_videos_pending_scheduled_index"`);
  }
}
