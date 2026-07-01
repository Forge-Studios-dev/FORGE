import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityEventCapacity1839000000000 implements MigrationInterface {
  name = 'CommunityEventCapacity1839000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Nullable: null = unlimited capacity (default for all event types)
    await queryRunner.query(
      `ALTER TABLE community_events ADD COLUMN IF NOT EXISTS capacity INTEGER NULL`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE community_events DROP COLUMN IF EXISTS capacity`,
    );
  }
}
