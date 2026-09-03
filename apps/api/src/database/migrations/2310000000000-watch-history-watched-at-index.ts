import { MigrationInterface, QueryRunner } from 'typeorm';

export class WatchHistoryWatchedAtIndex2310000000000 implements MigrationInterface {
  name = 'WatchHistoryWatchedAtIndex2310000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_watch_history_watched_at" ON "watch_history" ("watched_at" DESC)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_watch_history_watched_at"`);
  }
}
