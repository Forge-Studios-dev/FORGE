import { MigrationInterface, QueryRunner } from 'typeorm';

export class CommunityGroups1839100000000 implements MigrationInterface {
  name = 'CommunityGroups1839100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(120) NOT NULL,
        description TEXT,
        group_type VARCHAR(30) NOT NULL DEFAULT 'study',
        max_members INTEGER,
        weekly_goal TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_community_groups_community_id ON community_groups(community_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS community_group_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        group_id UUID NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL DEFAULT 'member',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(group_id, user_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_community_group_members_user_id ON community_group_members(user_id)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS community_group_members`);
    await queryRunner.query(`DROP TABLE IF EXISTS community_groups`);
  }
}
