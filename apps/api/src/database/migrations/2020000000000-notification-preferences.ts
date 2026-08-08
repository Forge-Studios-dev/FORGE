import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationPreferences2020000000000 implements MigrationInterface {
  name = 'NotificationPreferences2020000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "notification_preferences"
    `);
  }
}
