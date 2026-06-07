import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductionReadinessIndexes1780000000001 implements MigrationInterface {
  name = 'ProductionReadinessIndexes1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_videos_creator_status_published"
      ON "videos" ("user_id", "status", "published_at" DESC NULLS LAST)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_watch_history_user_watched"
      ON "watch_history" ("user_id", "watched_at" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_videos_creator_status_published"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_watch_history_user_watched"`);
  }
}
