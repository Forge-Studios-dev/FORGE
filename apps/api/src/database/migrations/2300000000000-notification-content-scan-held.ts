import { MigrationInterface, QueryRunner } from 'typeorm';

export class NotificationContentScanHeld2300000000000 implements MigrationInterface {
  name = 'NotificationContentScanHeld2300000000000';
  /** Postgres forbids ALTER TYPE ... ADD VALUE inside a transaction block. */
  transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE notifications_type_enum ADD VALUE IF NOT EXISTS 'content_scan_held'`,
    );
  }

  async down(_queryRunner: QueryRunner): Promise<void> {
    // Postgres cannot drop enum values without recreating the type.
  }
}
