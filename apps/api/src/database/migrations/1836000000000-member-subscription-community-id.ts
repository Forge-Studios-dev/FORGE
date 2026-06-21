import { MigrationInterface, QueryRunner } from 'typeorm';

export class MemberSubscriptionCommunityId1836000000000 implements MigrationInterface {
  name = 'MemberSubscriptionCommunityId1836000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE member_subscriptions
      ADD COLUMN IF NOT EXISTS community_id uuid NULL REFERENCES communities(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_member_subscriptions_community_id
      ON member_subscriptions (community_id)
      WHERE community_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_member_subscriptions_community_id`);
    await queryRunner.query(
      `ALTER TABLE member_subscriptions DROP COLUMN IF EXISTS community_id`,
    );
  }
}
