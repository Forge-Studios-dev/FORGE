import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationCopyrightStrikeTypes2240000000000 implements MigrationInterface {
  name = 'NotificationCopyrightStrikeTypes2240000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'copyright_takedown'`,
    );
    await queryRunner.query(
      `ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'copyright_video_reinstated'`,
    );
    await queryRunner.query(
      `ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'strike_issued'`,
    );
    await queryRunner.query(
      `ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'strike_rescinded'`,
    );
    await queryRunner.query(
      `ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'strike_appeal_resolved'`,
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres does not support removing enum values; requires recreating the type.
    // Safe to leave in place — no rows will use these values after rollback.
  }
}
