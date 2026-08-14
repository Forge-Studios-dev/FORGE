import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserWatchHistoryPaused1930000000000 implements MigrationInterface {
  name = 'UserWatchHistoryPaused1930000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "watch_history_paused" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "watch_history_paused"
    `);
  }
}
