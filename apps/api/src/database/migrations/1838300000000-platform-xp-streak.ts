import { MigrationInterface, QueryRunner } from 'typeorm';

export class PlatformXpStreak1838300000000 implements MigrationInterface {
  name = 'PlatformXpStreak1838300000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE platform_xp
        ADD COLUMN IF NOT EXISTS streak INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_check_in_at DATE NULL,
        ADD COLUMN IF NOT EXISTS longest_streak INT NOT NULL DEFAULT 0
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE platform_xp
        DROP COLUMN IF EXISTS streak,
        DROP COLUMN IF EXISTS last_check_in_at,
        DROP COLUMN IF EXISTS longest_streak
    `);
  }
}
