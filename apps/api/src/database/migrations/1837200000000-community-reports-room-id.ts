import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityReportsRoomId1837200000000 implements MigrationInterface {
  name = 'CommunityReportsRoomId1837200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE community_reports
      ADD COLUMN IF NOT EXISTS room_id uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_community_reports_room_id
      ON community_reports (room_id)
      WHERE room_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_community_reports_room_id`);
    await queryRunner.query(`
      ALTER TABLE community_reports
      DROP COLUMN IF EXISTS room_id
    `);
  }
}
