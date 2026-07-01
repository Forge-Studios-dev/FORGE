import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationGamificationTypes1838900000000 implements MigrationInterface {
  name = 'NotificationGamificationTypes1838900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'achievement_unlocked'`,
    );
    await queryRunner.query(
      `ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'xp_level_up'`,
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing enum values; requires recreating the type.
    // Safe to leave in place — no rows will use these values after rollback.
  }
}
