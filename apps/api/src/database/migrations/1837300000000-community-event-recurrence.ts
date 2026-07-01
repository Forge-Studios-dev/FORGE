import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityEventRecurrence1837300000000 implements MigrationInterface {
  name = 'CommunityEventRecurrence1837300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE community_events
      ADD COLUMN IF NOT EXISTS event_type varchar(16) NOT NULL DEFAULT 'one_off'
    `);
    await queryRunner.query(`
      ALTER TABLE community_events
      ADD COLUMN IF NOT EXISTS recurrence_rule varchar(16) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE community_events
      ADD COLUMN IF NOT EXISTS recurrence_until timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE community_events
      DROP COLUMN IF EXISTS recurrence_until
    `);
    await queryRunner.query(`
      ALTER TABLE community_events
      DROP COLUMN IF EXISTS recurrence_rule
    `);
    await queryRunner.query(`
      ALTER TABLE community_events
      DROP COLUMN IF EXISTS event_type
    `);
  }
}
