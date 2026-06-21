import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityRoomCategory1834000000000 implements MigrationInterface {
  name = 'CommunityRoomCategory1834000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE community_rooms
      ADD COLUMN IF NOT EXISTS category_id uuid NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_community_rooms_category_id
      ON community_rooms (category_id)
      WHERE category_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_community_rooms_category_id`);
    await queryRunner.query(`ALTER TABLE community_rooms DROP COLUMN IF EXISTS category_id`);
  }
}
