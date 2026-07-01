import { MigrationInterface, QueryRunner } from 'typeorm';

export class Achievements1838400000000 implements MigrationInterface {
  name = 'Achievements1838400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_achievements (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id     UUID NOT NULL,
        key         VARCHAR(64) NOT NULL,
        earned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT uq_user_achievement UNIQUE (user_id, key)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements (user_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_achievements`);
  }
}
