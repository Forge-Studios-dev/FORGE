import { MigrationInterface, QueryRunner } from 'typeorm';

/** Backs the 1-minute ScheduledPublishService scan — see scheduled-publish.service.ts. */
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
